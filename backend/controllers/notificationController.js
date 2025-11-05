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
        }

        // Format notifications - prioritize unread, then include activity logs
        const formattedMemoNotifications = memos
            .filter(memo => !memo.isRead || memo.activityType !== null) // Show unread memos OR activity logs
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
                        name: `${memo.sender.firstName} ${memo.sender.lastName}`,
                        email: memo.sender.email,
                        department: memo.sender.department
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

        const formattedAuditNotifications = auditLogs.map(l => ({
            id: l._id,
            type: 'user_log',
            title: l.subject || 'User Activity',
            message: l.message || '',
            sender: { name: l.email || 'System' },
            timestamp: l.createdAt,
            isRead: !!l.isRead,
            hasAttachments: false,
            metadata: { audit: true }
        }));

        // Count unread (all unread memos, not just activity logs)
        const unreadCount = await Memo.countDocuments({
            recipient: userId,
            isRead: false,
            status: { $ne: 'deleted' }
        });

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

        await Memo.findByIdAndUpdate(id, {
            isRead: true,
            readAt: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Error marking notification as read' });
    }
};

