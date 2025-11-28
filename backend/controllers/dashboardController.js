const User = require('../models/User');
const Memo = require('../models/Memo');

// Get dashboard stats for admin - SYSTEM-WIDE stats (not user-specific)
exports.getDashboardStats = async (req, res) => {
    try {
        // OPTIMIZED: Parallelize all database queries for MongoDB Atlas (reduces total time significantly)
        const [
            totalUsers,
            adminUsers,
            secretaryUsers,
            facultyUsers,
            activeUsers,
            totalMemosCount,
            totalMemosSent,
            pendingMemos,
            overdueMemos,
            recentMemosRaw
        ] = await Promise.all([
            // User stats (parallelized)
            User.countDocuments(),
            User.countDocuments({ role: 'admin' }),
            User.countDocuments({ role: 'secretary' }),
            User.countDocuments({ role: 'faculty' }),
            User.countDocuments({ lastLogin: { $exists: true } }),
            
            // Memo stats (parallelized)
            Memo.countDocuments({
                status: { $ne: 'deleted' },
                activityType: { $ne: 'system_notification' }
            }),
            Memo.countDocuments({
                status: { $in: ['sent', 'approved', 'read', 'pending'] },
                activityType: { $ne: 'system_notification' }
            }),
            Memo.countDocuments({
                status: 'pending',
                activityType: { $ne: 'system_notification' }
            }),
            Memo.countDocuments({
                dueDate: { $lt: new Date() },
                status: { $ne: 'deleted' },
                activityType: { $ne: 'system_notification' }
            }),
            
            // Recent memos (optimized - no populate, fetch users separately)
            Memo.find({
                status: { $ne: 'deleted' },
                activityType: { $ne: 'system_notification' }
            })
                .select('subject status priority createdAt department sender recipient')
                .sort({ createdAt: -1 })
                .limit(20)
                .lean()
        ]);

        // Total memos received (same as sent, since sent memos are received)
        const totalMemosReceived = totalMemosSent;

        // OPTIMIZED: Batch fetch all users at once (1 query instead of 20+ queries) - Much faster for Atlas
        const senderIds = [...new Set(recentMemosRaw.map(m => m.sender).filter(Boolean))];
        const recipientIds = [...new Set(recentMemosRaw.map(m => m.recipient).filter(Boolean))];
        const allUserIds = [...new Set([...senderIds, ...recipientIds])];
        
        const users = allUserIds.length > 0 ? await User.find({ _id: { $in: allUserIds } })
            .select('firstName lastName department profilePicture')
            .lean() : [];
        
        const userMap = new Map(users.map(u => [u._id.toString(), u]));
        
        // Map users to memos (in-memory, very fast)
        const recentMemos = recentMemosRaw.map(memo => ({
            ...memo,
            sender: memo.sender ? userMap.get(memo.sender.toString()) : null,
            recipient: memo.recipient ? userMap.get(memo.recipient.toString()) : null
        }));

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

        // OPTIMIZED: Parallelize all queries for MongoDB Atlas
        const [
            draftedMemos,
            sentMemosThisMonth,
            acknowledgedMemos,
            pendingMemos
        ] = await Promise.all([
            // Drafted Memos: memos with status 'draft' created by the secretary
            Memo.countDocuments({
                createdBy: userId,
                status: 'draft',
                activityType: { $ne: 'system_notification' }
            }),
            // Sent Memos: memos sent by secretary this month (status 'sent' or 'approved')
            Memo.countDocuments({
                sender: userId,
                status: { $in: ['sent', 'approved'] },
                createdAt: { $gte: startOfMonth },
                activityType: { $ne: 'system_notification' }
            }),
            // Acknowledged: memos sent by secretary that have been read/acknowledged
            Memo.countDocuments({
                sender: userId,
                $or: [
                    { status: 'read' },
                    { status: 'approved', isRead: true }
                ],
                activityType: { $ne: 'system_notification' }
            }),
            // Pending: memos sent by secretary that are pending approval
            Memo.countDocuments({
                sender: userId,
                status: 'pending',
                activityType: { $ne: 'system_notification' }
            })
        ]);

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

