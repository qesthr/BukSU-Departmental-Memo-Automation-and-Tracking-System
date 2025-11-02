const User = require('../models/User');
const Memo = require('../models/Memo');

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

        // Format notifications - prioritize unread, then include activity logs
        const formattedNotifications = memos
            .filter(memo => !memo.isRead || memo.activityType !== null) // Show unread memos OR activity logs
            .slice(0, 10) // Limit to 10 most recent
            .map(memo => ({
                id: memo._id,
                type: memo.activityType || 'memo_received',
                title: memo.subject || 'New Memo',
                message: memo.content || (memo.activityType ? 'System notification' : 'You have a new memo'),
                sender: memo.sender ? {
                    name: `${memo.sender.firstName} ${memo.sender.lastName}`,
                    email: memo.sender.email,
                    department: memo.sender.department
                } : null,
                timestamp: memo.createdAt,
                isRead: memo.isRead || false,
                hasAttachments: memo.attachments && memo.attachments.length > 0
            }));

        // Count unread (all unread memos, not just activity logs)
        const unreadCount = await Memo.countDocuments({
            recipient: userId,
            isRead: false,
            status: { $ne: 'deleted' }
        });

        res.json({
            success: true,
            notifications: formattedNotifications,
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

