const User = require('../models/User');
const Memo = require('../models/Memo');
const AuditLog = require('../models/AuditLog');

// Get notifications for user (both received memos and activity logs)
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get recent memos received by user (unread regular memos + activity logs)
        const memos = await Memo.find({
            recipient: userId,
            status: { $ne: 'deleted' }
        })
        .sort({ createdAt: -1 })
        .limit(20) // Get more to filter
        .populate('sender', 'firstName lastName email profilePicture department')
        .lean();

        // Also fetch recent audit logs for admins
        let auditLogs = [];
        if (req.user && req.user.role === 'admin') {
            auditLogs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean();

            // Enrich audit logs with user profile pictures if possible
            const emails = Array.from(new Set((auditLogs || []).map(l => l.email).filter(Boolean)));
            if (emails.length > 0) {
                const auditUsers = await User.find({ email: { $in: emails } })
                    .select('email firstName lastName profilePicture')
                    .lean();
                const emailToUser = Object.fromEntries(auditUsers.map(u => [u.email, u]));
                auditLogs = auditLogs.map(l => {
                    const u = emailToUser[l.email];
                    return u ? { ...l, _senderUser: u } : l;
                });
            }
        }

        // Format notifications - only include activity logs (exclude pending acknowledgement/unread memos)
        const formattedMemoNotifications = memos
            .filter(memo => memo.activityType !== null) // Show only activity logs, exclude unread memos
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

        const formattedAuditNotifications = auditLogs.map(l => {
            const u = l._senderUser;
            return {
                id: l._id,
                type: 'user_log',
                title: l.subject || 'User Activity',
                message: l.message || '',
                sender: u
                    ? { name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || (u.email || 'System'), email: u.email, profilePicture: u.profilePicture || null }
                    : { name: l.email || 'System' },
                timestamp: l.createdAt,
                isRead: !!l.isRead,
                hasAttachments: false,
                metadata: { audit: true }
            };
        });

        // Count unread activity logs only (exclude pending acknowledgement/unread memos)
        const unreadMemos = await Memo.countDocuments({
            recipient: userId,
            isRead: false,
            status: { $ne: 'deleted' },
            activityType: { $ne: null } // Only count activity logs, not regular unread memos
        });
        const unreadCount = unreadMemos;

        res.json({
            success: true,
            notifications: [...formattedAuditNotifications, ...formattedMemoNotifications].sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp)),
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

