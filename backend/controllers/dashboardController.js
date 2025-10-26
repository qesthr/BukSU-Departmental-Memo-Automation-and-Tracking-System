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

        // Get memo stats
        const totalMemosSent = await Memo.countDocuments({ status: 'sent' });
        const pendingMemos = await Memo.countDocuments({
            status: 'sent',
            isRead: false
        });
        const overdueMemos = await Memo.countDocuments({
            status: 'sent',
            dueDate: { $lt: new Date() }
        });

        // Get recent memos
        const recentMemos = await Memo.find({ status: 'sent' })
            .populate('sender', 'firstName lastName department profilePicture')
            .populate('recipient', 'firstName lastName department')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Format recent memos
        const formattedRecentMemos = recentMemos.map(memo => {
            // Determine icon color based on priority
            let iconType = 'blue';
            if (memo.priority === 'high' || memo.priority === 'urgent') {
                iconType = 'orange';
            }

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
                senderPicture: memo.sender?.profilePicture
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
                    totalSent: totalMemosSent,
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

