const Memo = require('../models/Memo');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');

/**
 * Get memo filter to exclude system-generated memos and only include admin/secretary memos
 * @returns {Object} MongoDB query filter
 */
async function getMemoFilter(baseFilter = {}) {
    // Get admin and secretary user IDs (only memos they create are counted)
    const adminSecretaryUsers = await User.find({
        role: { $in: ['admin', 'secretary'] }
    }).select('_id').lean();

    const adminSecretaryIds = adminSecretaryUsers.map(u => u._id);

    // System / non-memo activity types to exclude completely from analytics
    // We only want "real" memos created by admins/secretaries
    const systemActivityTypes = [
        'user_activity',
        'system_notification',
        'user_deleted',
        'password_reset',
        'welcome_email',
        'user_profile_edited',
        'memo_received',
        'calendar_connected'
    ];

    return {
        // Base filters (e.g., date range)
        ...baseFilter,
        // Only memos created by admins or secretaries
        sender: { $in: adminSecretaryIds },
        // Exclude archived / deleted from totals and analytics by default
        status: { $nin: ['archived', 'deleted'] },
        // Exclude system / derived activity types
        activityType: { $nin: systemActivityTypes }
    };
}

/**
 * Get overall statistics
 */
async function getOverallStats() {
    try {
        const memoFilter = await getMemoFilter({ status: { $ne: 'deleted' } });

        const [totalMemos, totalUsers, totalDepartments, totalEvents] = await Promise.all([
            Memo.countDocuments(memoFilter),
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
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const dateFilter = await getMemoFilter(baseDateFilter);

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
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const dateFilter = await getMemoFilter(baseDateFilter);

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
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const dateFilter = await getMemoFilter(baseDateFilter);

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
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const dateFilter = await getMemoFilter(baseDateFilter);

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
 * Get calendar events over time (daily)
 */
async function getEventsOverTime(startDate, endDate) {
    try {
        const dateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'cancelled' }
        };

        const stats = await CalendarEvent.aggregate([
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
        console.error('Error fetching events over time:', error);
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
        const memoFilter = await getMemoFilter({ status: { $ne: 'deleted' } });

        const activities = await Memo.find(memoFilter)
            .populate('sender', 'firstName lastName email department')
            .populate('recipient', 'firstName lastName email department')
            .populate('recipients', 'firstName lastName email department')
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('subject status priority department departments createdAt sender recipient recipients');

        return activities.map(activity => {
            // Get recipient departments
            let recipientDepartments = [];

            // If departments array exists, use those
            if (activity.departments && Array.isArray(activity.departments) && activity.departments.length > 0) {
                recipientDepartments = [...new Set(activity.departments)]; // Remove duplicates
            }
            // If recipients array exists, get their departments
            else if (activity.recipients && Array.isArray(activity.recipients) && activity.recipients.length > 0) {
                const deptSet = new Set();
                activity.recipients.forEach(recipient => {
                    if (recipient && recipient.department) {
                        deptSet.add(recipient.department);
                    }
                });
                recipientDepartments = Array.from(deptSet);
            }
            // If single recipient exists, use their department
            else if (activity.recipient && activity.recipient.department) {
                recipientDepartments = [activity.recipient.department];
            }
            // Fallback to memo's department field
            else if (activity.department) {
                recipientDepartments = [activity.department];
            }

            return {
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
                recipients: activity.recipients ? activity.recipients.map(r => ({
                    name: r ? `${r.firstName} ${r.lastName}` : 'Unknown',
                    email: r ? r.email : '',
                    department: r ? r.department : ''
                })) : [],
                status: activity.status,
                priority: activity.priority,
                department: activity.department,
                departments: recipientDepartments
            };
        });
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
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const dateFilter = await getMemoFilter(baseDateFilter);

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

/**
 * Get activity logs over time from system memos
 * This includes all activity types: user_activity, system_notification, etc.
 */
async function getActivityLogsOverTime(startDate, endDate, activityType = null) {
    try {
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        // Filter for system activity types
        const systemActivityTypes = [
            'user_activity',
            'system_notification',
            'user_deleted',
            'password_reset',
            'welcome_email',
            'memo_sent',
            'memo_approved',
            'memo_rejected',
            'pending_memo'
        ];

        const dateFilter = {
            ...baseDateFilter,
            activityType: activityType
                ? { $eq: activityType }
                : { $in: systemActivityTypes }
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
        console.error('Error fetching activity logs over time:', error);
        throw error;
    }
}

/**
 * Get activity logs by type over time
 */
async function getActivityLogsByTypeOverTime(startDate, endDate) {
    try {
        const baseDateFilter = {
            createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            },
            status: { $ne: 'deleted' }
        };

        const systemActivityTypes = [
            'user_activity',
            'system_notification',
            'user_deleted',
            'password_reset',
            'welcome_email',
            'memo_sent',
            'memo_approved',
            'memo_rejected',
            'pending_memo'
        ];

        const dateFilter = {
            ...baseDateFilter,
            activityType: { $in: systemActivityTypes }
        };

        const stats = await Memo.aggregate([
            { $match: dateFilter },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        activityType: '$activityType'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.date': 1, '_id.activityType': 1 } }
        ]);

        return stats;
    } catch (error) {
        console.error('Error fetching activity logs by type over time:', error);
        throw error;
    }
}

module.exports = {
    getOverallStats,
    getMemoStatsByStatus,
    getMemoStatsByPriority,
    getMemoStatsByDepartment,
    getMemosOverTime,
    getEventsOverTime,
    getUserStats,
    getRecentActivity,
    getMemoStatsForDateRange,
    getUserActivityOverTime,
    getActivityLogsOverTime,
    getActivityLogsByTypeOverTime
};

