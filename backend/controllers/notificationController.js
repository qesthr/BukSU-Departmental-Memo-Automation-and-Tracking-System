const User = require('../models/User');
const Memo = require('../models/Memo');

// Get notifications for admin
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get recent activity logs (from Memo collection) for any user
        const notifications = await Memo.find({
            recipient: userId,
            activityType: { $ne: null },
            status: { $ne: 'deleted' }
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('sender', 'firstName lastName email profilePicture department')
        .lean();

        // Format notifications
        const formattedNotifications = notifications.map(memo => ({
            id: memo._id,
            type: memo.activityType,
            title: memo.subject,
            message: memo.content,
            sender: memo.sender ? {
                name: `${memo.sender.firstName} ${memo.sender.lastName}`,
                email: memo.sender.email,
                department: memo.sender.department
            } : null,
            timestamp: memo.createdAt,
            isRead: memo.isRead || false
        }));

        // Count unread
        const unreadCount = notifications.filter(n => !n.isRead).length;

        res.json({
            success: true,
            notifications: formattedNotifications,
            unreadCount
        });
    } catch (error) {
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

