const Memo = require('../models/Memo');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');

/**
 * Get overall statistics
 */
async function getOverallStats() {
    try {
        const [totalMemos, totalUsers, totalDepartments, totalEvents] = await Promise.all([
            Memo.countDocuments({ status: { $ne: 'deleted' } }),
            User.countDocuments({ isActive: true }),
            User.distinct('department'),
            CalendarEvent.countDocuments({ status: { $ne: 'cancelled' } })
        ]);

        return {
            totalMemos,
            totalUsers,
            totalDepartments: totalDepartments.length,
            totalEvents
        };
    } catch (error) {
        console.error('Error fetching overall stats:', error);
        throw error;
    }
}

/**
 * Get memo statistics by status
 */
async function getMemoStatsByStatus(startDate, endDate) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const stats = await Memo.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        return stats;
    } catch (error) {
        console.error('Error fetching memo stats by status:', error);
        throw error;
    }
}

/**
 * Get memo statistics by priority
 */
async function getMemoStatsByPriority(startDate, endDate) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const stats = await Memo.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: '$priority',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        return stats;
    } catch (error) {
        console.error('Error fetching memo stats by priority:', error);
        throw error;
    }
}

/**
 * Get memo statistics by department
 */
async function getMemoStatsByDepartment(startDate, endDate) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const stats = await Memo.aggregate([
            { $match: dateFilter },
            { $unwind: { path: '$departments', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$departments', '$department'] },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: { $ifNull: ['$_id', 'Admin'] },
                    count: 1
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        return stats;
    } catch (error) {
        console.error('Error fetching memo stats by department:', error);
        throw error;
    }
}

/**
 * Get memos over time (daily)
 */
async function getMemosOverTime(startDate, endDate) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const stats = await Memo.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return stats;
    } catch (error) {
        console.error('Error fetching memos over time:', error);
        throw error;
    }
}

/**
 * Get user statistics
 */
async function getUserStats() {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 },
                    active: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Also get department distribution
        const departmentStats = await User.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        return {
            byRole: stats,
            byDepartment: departmentStats
        };
    } catch (error) {
        console.error('Error fetching user stats:', error);
        throw error;
    }
}

/**
 * Get recent activity
 */
async function getRecentActivity(limit = 50) {
    try {
        const activities = await Memo.find({
            status: { $ne: 'deleted' }
        })
            .populate('sender', 'firstName lastName email department')
            .populate('recipient', 'firstName lastName email department')
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('subject status priority department createdAt sender recipient');

        return activities.map(activity => ({
            id: activity._id,
            date: activity.createdAt,
            subject: activity.subject,
            sender: activity.sender ? {
                name: `${activity.sender.firstName} ${activity.sender.lastName}`,
                email: activity.sender.email,
                department: activity.sender.department
            } : null,
            recipient: activity.recipient ? {
                name: `${activity.recipient.firstName} ${activity.recipient.lastName}`,
                email: activity.recipient.email,
                department: activity.recipient.department
            } : null,
            status: activity.status,
            priority: activity.priority,
            department: activity.department
        }));
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        throw error;
    }
}

/**
 * Get memo statistics for date range
 */
async function getMemoStatsForDateRange(startDate, endDate) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const [total, sent, read, pending, byPriority, byDepartment] = await Promise.all([
            Memo.countDocuments(dateFilter),
            Memo.countDocuments({ ...dateFilter, status: 'sent' }),
            Memo.countDocuments({ ...dateFilter, status: 'read' }),
            Memo.countDocuments({ ...dateFilter, status: 'pending' }),
            getMemoStatsByPriority(startDate, endDate),
            getMemoStatsByDepartment(startDate, endDate)
        ]);

        return {
            total,
            sent,
            read,
            pending,
            byPriority,
            byDepartment
        };
    } catch (error) {
        console.error('Error fetching memo stats for date range:', error);
        throw error;
    }
}

/**
 * Get user activity over time
 */
async function getUserActivityOverTime(startDate, endDate) {
    try {
        const dateFilter = {
            lastLogin: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            isActive: true
        };

        const stats = await User.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$lastLogin' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return stats;
    } catch (error) {
        console.error('Error fetching user activity over time:', error);
        throw error;
    }
}

module.exports = {
    getOverallStats,
    getMemoStatsByStatus,
    getMemoStatsByPriority,
    getMemoStatsByDepartment,
    getMemosOverTime,
    getUserStats,
    getRecentActivity,
    getMemoStatsForDateRange,
    getUserActivityOverTime
};

