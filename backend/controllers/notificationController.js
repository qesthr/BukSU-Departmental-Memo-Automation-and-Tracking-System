const User = require('../models/User');
const Memo = require('../models/Memo');

// Get notifications for user (both received memos and activity logs)
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get recent memos received by user (memo and calendar notifications only)
        // Exclude deleted and archived notifications (archived = already processed/approved/rejected)
        // Exclude acknowledgment notifications
        const memos = await Memo.find({
            recipient: userId,
            status: { $nin: ['deleted', 'archived'] },
            // Exclude acknowledgment notifications
            $nor: [
                { 'metadata.notificationType': 'acknowledgment' },
                { subject: /^Memo Acknowledged:/i }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(20) // Get more to filter
        .populate('sender', 'firstName lastName email profilePicture department')
        .lean();

        // Format notifications - ONLY memo and calendar-related notifications
        // Filter out all system activity logs (they go to Activity Logs page instead)
        const memoAndCalendarActivityTypes = [
            'memo_sent',
            'memo_received',
            'pending_memo',
            'memo_approved',
            'memo_rejected',
            'system_notification' // Calendar events use this type
        ];

        const formattedMemoNotifications = memos
            .filter(memo => {
                // Exclude acknowledgment notifications (double-check in filter)
                if (memo.metadata?.notificationType === 'acknowledgment' ||
                    (memo.subject && /^Memo Acknowledged:/i.test(memo.subject))) {
                    return false;
                }

                // Exclude memos created by the user (they are the sender)
                // UNLESS it's a pending approval notification (which is sent TO them)
                const isPendingApprovalNotification = memo.activityType === 'system_notification' &&
                    (memo.metadata?.eventType === 'memo_review_decision' ||
                     memo.metadata?.eventType === 'memo_pending_review') &&
                    (memo.subject && /pending approval/i.test(memo.subject));

                // If user is the sender and it's NOT a pending approval notification, exclude it
                const senderId = memo.sender?._id?.toString() || memo.sender?.toString();
                const userIdStr = userId.toString();
                if (senderId === userIdStr && !isPendingApprovalNotification) {
                    return false;
                }

                // Include regular memos (no activityType) OR memo/calendar-related activity types
                if (!memo.activityType) {
                    return true; // Regular memo
                }
                // Only include memo/calendar activity types
                return memoAndCalendarActivityTypes.includes(memo.activityType) ||
                       (memo.metadata && memo.metadata.eventType === 'calendar_event');
            })
            .slice(0, 10) // Limit to 10 most recent
            .map(memo => {
                // Normalize type for workflow-related system notifications
                let normalizedType = memo.activityType || 'memo_received';
                const subjectLower = (memo.subject || '').toLowerCase();
                if (normalizedType === 'system_notification') {
                    if (subjectLower.includes('pending approval')) {
                        normalizedType = 'pending_memo';
                    } else if (subjectLower.includes('memo approved')) {
                        normalizedType = 'memo_approved';
                    } else if (subjectLower.includes('memo rejected')) {
                        normalizedType = 'memo_rejected';
                    }
                }

                // Prefer the original memo id if present in metadata for workflow items
                // BUT: For regular memos (memo_received), use the memo's own ID so faculty can view their delivered memo
                const originalMemoId = (memo.metadata && (memo.metadata.originalMemoId || memo.metadata.relatedMemoId)) || null;

                // For system notifications (pending/approved/rejected), use originalMemoId
                // For regular memos, use the memo's own ID
                const isWorkflowNotification = normalizedType === 'pending_memo' || normalizedType === 'memo_approved' || normalizedType === 'memo_rejected';
                const memoIdToUse = (isWorkflowNotification && originalMemoId) ? originalMemoId : memo._id;

                return {
                    id: memo._id,
                    type: normalizedType,
                    title: memo.subject || 'New Memo',
                    message: memo.content || (memo.activityType ? 'System notification' : 'You have a new memo'),
                    sender: memo.sender ? {
                        name: `${memo.sender.firstName} ${memo.sender.lastName}`.trim(),
                        email: memo.sender.email,
                        department: memo.sender.department,
                        profilePicture: memo.sender.profilePicture || null
                    } : null,
                    timestamp: memo.createdAt,
                    isRead: memo.isRead || false,
                    hasAttachments: memo.attachments && memo.attachments.length > 0,
                    // Expose metadata to the client so it can resolve original memo id
                    metadata: memo.metadata || {},
                    // Provide a direct memoId field the UI can use to open the correct memo
                    memoId: memoIdToUse,
                    originalMemoId: originalMemoId
                };
            });

        // REMOVED: Audit logs no longer appear in notifications
        // They are now in Activity Logs page only

        // Count unread notifications (memo and calendar events only)
        // Exclude acknowledgment notifications and memos created by the user
        // BUT include pending approval notifications (even though user is sender, they're sent TO user)
        const unreadMemos = await Memo.countDocuments({
            recipient: userId,
            isRead: false,
            status: { $nin: ['deleted', 'archived'] },
            // Exclude acknowledgment notifications
            $nor: [
                { 'metadata.notificationType': 'acknowledgment' },
                { subject: /^Memo Acknowledged:/i }
            ],
            $or: [
                // Include pending approval notifications (even if sender is user)
                {
                    activityType: 'system_notification',
                    'metadata.eventType': { $in: ['memo_review_decision', 'memo_pending_review'] },
                    subject: /pending approval/i
                },
                // Regular memos (where user is NOT the sender)
                {
                    activityType: null,
                    sender: { $ne: userId }
                },
                // Memo/calendar activity types (where user is NOT the sender)
                {
                    activityType: { $in: memoAndCalendarActivityTypes },
                    sender: { $ne: userId }
                },
                // Calendar events (where user is NOT the sender)
                {
                    'metadata.eventType': 'calendar_event',
                    sender: { $ne: userId }
                }
            ]
        });
        const unreadCount = unreadMemos;

        res.json({
            success: true,
            notifications: formattedMemoNotifications.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp)),
            unreadCount
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        // Try marking a memo notification as read
        const memoResult = await Memo.findByIdAndUpdate(id, {
            isRead: true,
            readAt: new Date()
        });

        // If no memo was updated, try audit log (admin notifications)
        if (!memoResult) {
            try {
                await AuditLog.findByIdAndUpdate(id, { isRead: true });
            } catch (_) {
                // ignore - not an audit log
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Error marking notification as read' });
    }
};

