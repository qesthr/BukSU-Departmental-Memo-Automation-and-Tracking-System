const User = require('../models/User');
const Memo = require('../models/Memo');

// Get dashboard stats for admin
exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get user stats
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const secretaryUsers = await User.countDocuments({ role: 'secretary' });
        const facultyUsers = await User.countDocuments({ role: 'faculty' });
        const activeUsers = await User.countDocuments({ lastLogin: { $exists: true } });

        // Get user-specific memo stats
        // Total memos = memos where user is sender OR recipient (excluding deleted)
        const totalMemosCount = await Memo.countDocuments({
            $or: [
                { sender: userId },
                { recipient: userId }
            ],
            status: { $ne: 'deleted' }
        });

        // Memos sent by this user
        const totalMemosSent = await Memo.countDocuments({
            sender: userId,
            status: { $ne: 'deleted' }
        });

        // Memos received by this user
        const totalMemosReceived = await Memo.countDocuments({
            recipient: userId,
            status: { $ne: 'deleted' }
        });

        // Pending memos (unread memos received by this user)
        const pendingMemos = await Memo.countDocuments({
            recipient: userId,
            isRead: false,
            status: { $ne: 'deleted' }
        });

        // Overdue memos (received memos with past due date)
        const overdueMemos = await Memo.countDocuments({
            recipient: userId,
            dueDate: { $lt: new Date() },
            status: { $ne: 'deleted' }
        });

        // Get recent memos for this user (sent or received)
        const recentMemos = await Memo.find({
            $or: [
                { sender: userId },
                { recipient: userId }
            ],
            status: { $ne: 'deleted' }
        })
            .populate('sender', 'firstName lastName department profilePicture')
            .populate('recipient', 'firstName lastName department')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Format recent memos - differentiate between sent and received
        const formattedRecentMemos = recentMemos.map(memo => {
            // Determine icon color based on priority
            let iconType = 'blue';
            if (memo.priority === 'high' || memo.priority === 'urgent') {
                iconType = 'orange';
            }

            // Check if user is sender or recipient
            const isSent = memo.sender?._id?.toString() === userId.toString();
            const isReceived = memo.recipient?._id?.toString() === userId.toString();

            return {
                id: memo._id,
                title: memo.subject,
                department: memo.department || memo.sender?.department || 'Unknown',
                date: new Date(memo.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                }),
                type: iconType,
                sender: memo.sender?.firstName + ' ' + memo.sender?.lastName,
                senderPicture: memo.sender?.profilePicture,
                recipient: memo.recipient?.firstName + ' ' + memo.recipient?.lastName,
                isSent: isSent,
                isReceived: isReceived
            };
        });

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    admins: adminUsers,
                    secretaries: secretaryUsers,
                    faculty: facultyUsers,
                    active: activeUsers
                },
                memos: {
                    total: totalMemosCount, // Total memos (sent + received) for this user
                    totalSent: totalMemosSent, // Memos sent by this user
                    totalReceived: totalMemosReceived, // Memos received by this user
                    pending: pendingMemos,
                    overdue: overdueMemos
                },
                recentMemos: formattedRecentMemos
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics'
        });
    }
};

// Get dashboard stats for secretary
exports.getSecretaryDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get current month start date
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Drafted Memos: memos with status 'draft' created by the secretary
        const draftedMemos = await Memo.countDocuments({
            createdBy: userId,
            status: 'draft',
            activityType: { $ne: 'system_notification' }
        });

        // Sent Memos: memos sent by secretary this month (status 'sent' or 'approved')
        const sentMemosThisMonth = await Memo.countDocuments({
            sender: userId,
            status: { $in: ['sent', 'approved'] },
            createdAt: { $gte: startOfMonth },
            activityType: { $ne: 'system_notification' }
        });

        // Acknowledged: memos sent by secretary that have been read/acknowledged
        const acknowledgedMemos = await Memo.countDocuments({
            sender: userId,
            $or: [
                { status: 'read' },
                { status: 'approved', isRead: true }
            ],
            activityType: { $ne: 'system_notification' }
        });

        // Pending: memos sent by secretary that are pending approval (status 'pending' means pending admin approval for secretary-created memos)
        const pendingMemos = await Memo.countDocuments({
            sender: userId,
            status: 'pending',
            activityType: { $ne: 'system_notification' }
        });

        res.json({
            success: true,
            stats: {
                drafted: draftedMemos,
                sent: sentMemosThisMonth,
                acknowledged: acknowledgedMemos,
                pending: pendingMemos
            }
        });
    } catch (error) {
        console.error('Error fetching secretary dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching secretary dashboard statistics'
        });
    }
};

