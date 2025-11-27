const User = require('../models/User');
const Memo = require('../models/Memo');

// Get dashboard stats for admin - SYSTEM-WIDE stats (not user-specific)
exports.getDashboardStats = async (req, res) => {
    try {
        // Get user stats (system-wide)
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const secretaryUsers = await User.countDocuments({ role: 'secretary' });
        const facultyUsers = await User.countDocuments({ role: 'faculty' });
        const activeUsers = await User.countDocuments({ lastLogin: { $exists: true } });

        // Get ADMIN-LEVEL memo stats (ALL memos in the system)
        // Total memos = ALL memos in the system (excluding deleted)
        const totalMemosCount = await Memo.countDocuments({
            status: { $ne: 'deleted' },
            activityType: { $ne: 'system_notification' }
        });

        // Total memos sent (memos that have been sent, not drafts)
        const totalMemosSent = await Memo.countDocuments({
            status: { $in: ['sent', 'approved', 'read', 'pending'] },
            activityType: { $ne: 'system_notification' }
        });

        // Total memos received (same as sent, since sent memos are received)
        // For admin dashboard, this represents total memo transactions
        const totalMemosReceived = totalMemosSent;

        // Pending memos (ALL memos pending admin approval)
        const pendingMemos = await Memo.countDocuments({
            status: 'pending',
            activityType: { $ne: 'system_notification' }
        });

        // Overdue memos (ALL memos with past due date)
        const overdueMemos = await Memo.countDocuments({
            dueDate: { $lt: new Date() },
            status: { $ne: 'deleted' },
            activityType: { $ne: 'system_notification' }
        });

        // Get recent memos (ALL recent memos in the system)
        const recentMemos = await Memo.find({
            status: { $ne: 'deleted' },
            activityType: { $ne: 'system_notification' }
        })
            .populate('sender', 'firstName lastName department profilePicture')
            .populate('recipient', 'firstName lastName department')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // Format recent memos - differentiate between sent and received
        const formattedRecentMemos = recentMemos.map(memo => {
            // Determine icon color based on status and priority
            let iconType = 'blue';
            if (memo.status === 'pending') {
                iconType = 'orange';
            } else if (memo.priority === 'high' || memo.priority === 'urgent') {
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
                sender: memo.sender ? `${memo.sender.firstName} ${memo.sender.lastName}` : 'Unknown',
                senderPicture: memo.sender?.profilePicture,
                recipient: memo.recipient ? `${memo.recipient.firstName} ${memo.recipient.lastName}` : 'Unknown',
                status: memo.status,
                isSent: !!memo.sender,
                isReceived: !!memo.recipient
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
                    total: totalMemosCount, // Total memos in the system
                    totalSent: totalMemosSent, // Total memos sent (all memos)
                    totalReceived: totalMemosReceived, // Total memos received (all memos)
                    pending: pendingMemos, // Memos pending admin approval
                    overdue: overdueMemos // Memos with past due dates
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

