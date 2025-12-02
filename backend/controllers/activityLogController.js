const ActivityLog = require('../models/ActivityLog');
const AuditLog = require('../models/AuditLog');
const Memo = require('../models/Memo');
const User = require('../models/User');

/**
 * Get Activity Logs with filtering and pagination
 * Admin only
 */
exports.getActivityLogs = async (req, res) => {
    try {
        // Admin only
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        // Parse query parameters
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const skip = (page - 1) * limit;

        // Build filter query
        const filter = {};

        // Filter by actor role
        if (req.query.actorRole && ['admin', 'secretary', 'faculty'].includes(req.query.actorRole)) {
            filter.actorRole = req.query.actorRole;
        }

        // Filter by action type
        if (req.query.actionType) {
            filter.actionType = req.query.actionType;
        }

        // Filter by target resource
        if (req.query.targetResource) {
            filter.targetResource = req.query.targetResource;
        }

        // Filter by date range
        if (req.query.startDate || req.query.endDate) {
            filter.timestamp = {};
            if (req.query.startDate) {
                filter.timestamp.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filter.timestamp.$lte = new Date(req.query.endDate);
            }
        }

        // Search by description, actor name, or target name
        if (req.query.search) {
            filter.$or = [
                { description: { $regex: req.query.search, $options: 'i' } },
                { actorName: { $regex: req.query.search, $options: 'i' } },
                { targetName: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Fetch logs from multiple sources and merge them
        // NOTE: When actorRole is not specified (or empty string from "All Roles" selection),
        // admins will see ALL activities from ALL roles (admin, secretary, faculty).
        // Only when a specific role is selected will filtering be applied.

        // If filtering by actorRole, get user IDs with that role first
        let userIdsWithRole = null;
        if (req.query.actorRole && req.query.actorRole.trim() !== '' && ['admin', 'secretary', 'faculty'].includes(req.query.actorRole)) {
            const usersWithRole = await User.find({ role: req.query.actorRole }).select('_id').lean();
            userIdsWithRole = usersWithRole.map(u => u._id);
        }

        // 1. Query ActivityLog collection (new logs)
        const activityLogsQuery = ActivityLog.find(filter)
            .sort({ timestamp: -1 })
            .populate('actorUserId', 'firstName lastName email profilePicture role')
            .lean();

        // 2. Query AuditLog collection (existing audit logs)
        // If filtering by actorRole, filter by user IDs at database level
        const auditLogFilter = {};
        if (userIdsWithRole !== null) {
            if (userIdsWithRole.length > 0) {
                auditLogFilter.user = { $in: userIdsWithRole };
            } else {
                // No users with this role, return empty result
                auditLogFilter.user = { $in: [] };
            }
        }

        const auditLogsQuery = AuditLog.find(auditLogFilter)
            .sort({ createdAt: -1 })
            .populate('user', 'firstName lastName email profilePicture role')
            .lean();

        // 3. Query Memo collection for system activity logs (existing system memos)
        // These are memos with activityType that should be in Activity Logs, not notifications
        const systemActivityTypes = [
            'user_activity',
            'user_deleted', // Keep for existing data - but new logs should use user_archived
            'password_reset',
            'welcome_email',
            'user_profile_edited',
            'memo_created',
            'memo_edited',
            'memo_deleted', // Keep for existing data - but new logs should use memo_archived
            'memo_archived',
            'memo_starred',
            'memo_unstarred',
            'memo_marked_read',
            'memo_approved',
            'memo_rejected'
        ];

        // If filtering by actorRole, filter memos by sender IDs at database level
        const memoLogFilter = {
            activityType: { $in: systemActivityTypes }
        };
        if (userIdsWithRole !== null) {
            if (userIdsWithRole.length > 0) {
                memoLogFilter.sender = { $in: userIdsWithRole };
            } else {
                // No users with this role, return empty result
                memoLogFilter.sender = { $in: [] };
            }
        }

        const memoLogsQuery = Memo.find(memoLogFilter)
        .sort({ createdAt: -1 })
        .populate('sender', 'firstName lastName email profilePicture role')
        .lean();

        // Execute all queries
        const [activityLogs, auditLogs, memoLogs] = await Promise.all([
            activityLogsQuery,
            auditLogsQuery,
            memoLogsQuery
        ]);

        // Map AuditLog actions to ActivityLog actionTypes
        const mapAuditActionToActivityType = (action) => {
            const actionMap = {
                'login_success': 'user_login',
                'login_failed': 'user_login', // Could be separate, but keeping as login for now
                // Exclude lock operations from Activity Logs (user requested)
                // 'user_lock_acquired': 'user_lock_acquired',
                // 'user_lock_refreshed': 'user_lock_acquired',
                // 'user_lock_released': 'user_lock_released',
                'user_updated': 'user_updated',
                'user_deleted': 'user_archived', // Map old delete to archive for existing data
                'user_created': 'user_created'
            };
            return actionMap[action] || action || 'user_activity';
        };

        // Convert AuditLog entries to ActivityLog format
        // Filter out lock operations (user requested to exclude them from Activity Logs)
        // Also batch fetch user names for user_updated actions that don't have targetName
        const userUpdateLogs = auditLogs.filter(log => {
            const lockActions = ['user_lock_acquired', 'user_lock_refreshed', 'user_lock_released'];
            return !lockActions.includes(log.action) && mapAuditActionToActivityType(log.action) === 'user_updated' && !log.metadata?.targetName && log.metadata?.targetUserId;
        });
        
        // Batch fetch user names for logs missing targetName
        const userIdsToFetch = [...new Set(userUpdateLogs.map(log => log.metadata?.targetUserId).filter(Boolean))];
        let userNamesMap = new Map();
        if (userIdsToFetch.length > 0) {
            try {
                const User = require('../models/User');
                const users = await User.find({ _id: { $in: userIdsToFetch } }).select('firstName lastName email').lean();
                users.forEach(user => {
                    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';
                    userNamesMap.set(user._id.toString(), name);
                });
            } catch (e) {
                console.error('Error fetching user names for activity logs:', e);
            }
        }
        
        const formattedAuditLogs = auditLogs
            .filter(log => {
                // Exclude lock operations from Activity Logs
                const lockActions = ['user_lock_acquired', 'user_lock_refreshed', 'user_lock_released'];
                return !lockActions.includes(log.action);
            })
            .map(log => {
                const mappedActionType = mapAuditActionToActivityType(log.action);
                
                // Extract target name - prioritize metadata.targetName (now set in audit call)
                let targetName = log.metadata?.targetName || '';
                
                // For user_updated actions, if targetName is still not set, fetch from map or extract from description
                if (!targetName && mappedActionType === 'user_updated' && log.metadata?.targetUserId) {
                    const userIdStr = log.metadata.targetUserId.toString();
                    targetName = userNamesMap.get(userIdStr) || log.metadata?.targetUserEmail || '';
                    
                    // Last resort: try to extract email from description
                    if (!targetName) {
                        const emailMatch = log.message?.match(/Updated user (.+)/);
                        if (emailMatch) {
                            targetName = emailMatch[1].trim();
                        }
                    }
                }
                
                return {
                    id: log._id,
                    actor: {
                        id: log.user?._id || log.user,
                        name: log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.email : log.email,
                        email: log.email,
                        role: log.user?.role || 'faculty',
                        profilePicture: log.user?.profilePicture || null
                    },
                    actionType: mappedActionType,
                    description: log.message || log.subject || `User ${log.action || 'activity'}`,
                    targetResource: log.metadata?.targetResource || (mappedActionType.startsWith('user_') ? 'user' : null),
                    targetId: log.metadata?.targetId || log.metadata?.targetUserId || null,
                    targetName: targetName,
                    metadata: { ...log.metadata, originalAction: log.action },
                    ipAddress: log.metadata?.ipAddress || '',
                    timestamp: log.createdAt
                };
            });

        // Map Memo activityTypes to ActivityLog actionTypes
        const mapMemoActivityTypeToActivityType = (activityType) => {
            const typeMap = {
                'user_activity': 'user_activity',
                'user_deleted': 'user_archived', // Map old delete to archive for existing data
                'password_reset': 'password_reset_requested',
                'welcome_email': 'welcome_email_sent',
                'user_profile_edited': 'user_profile_updated',
                'memo_created': 'memo_created',
                'memo_edited': 'memo_edited',
                'memo_deleted': 'memo_archived', // Map old delete to archive for existing data
                'memo_archived': 'memo_archived',
                'memo_starred': 'memo_starred',
                'memo_unstarred': 'memo_unstarred',
                'memo_marked_read': 'memo_marked_read',
                'memo_approved': 'memo_approved',
                'memo_rejected': 'memo_rejected',
                'system_notification': null // These are notifications, not activity logs
            };
            return typeMap[activityType] || activityType;
        };

        // Convert Memo entries to ActivityLog format
        const formattedMemoLogs = memoLogs
            .map(memo => {
                const mappedActionType = mapMemoActivityTypeToActivityType(memo.activityType);
                // Skip system_notification memos (they're notifications, not activity logs)
                if (mappedActionType === null) {return null;}

                // Extract target name for user-related actions
                let targetName = memo.metadata?.targetName || '';
                
                // For user_profile_edited memos, extract the edited user's name
                if (mappedActionType === 'user_profile_updated') {
                    // Priority: metadata.targetName > extract from subject > metadata.editedUserEmail
                    if (!targetName) {
                        // Try to extract name from subject like "User profile updated: Clarisse Ramos"
                        const subjectMatch = memo.subject?.match(/User profile updated: (.+)/);
                        if (subjectMatch) {
                            targetName = subjectMatch[1].trim();
                        } else if (memo.metadata?.editedUserEmail) {
                            // Fallback to email if name not available
                            targetName = memo.metadata.editedUserEmail;
                        } else {
                            // Last fallback: use subject (but this should rarely happen now)
                            targetName = memo.subject || '';
                        }
                    }
                } else if (!targetName) {
                    // For other memos, use subject as fallback
                    targetName = memo.subject || '';
                }

                return {
                    id: memo._id,
                    actor: {
                        id: memo.sender?._id || memo.sender,
                        name: memo.sender ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim() || memo.sender.email : 'System',
                        email: memo.sender?.email || '',
                        role: memo.sender?.role || 'faculty',
                        profilePicture: memo.sender?.profilePicture || null
                    },
                    actionType: mappedActionType,
                    description: memo.content || memo.subject || 'System activity',
                    targetResource: memo.metadata?.targetResource ||
                                   (mappedActionType.startsWith('memo_') ? 'memo' :
                                    mappedActionType.startsWith('user_') ? 'user' : null),
                    targetId: memo.metadata?.targetId || memo.metadata?.editedUserId || memo.metadata?.memoId || null,
                    targetName: targetName,
                    metadata: memo.metadata || {},
                    ipAddress: memo.metadata?.ipAddress || '',
                    timestamp: memo.createdAt
                };
            })
            .filter(log => log !== null); // Remove null entries

        // Format ActivityLog entries
        const formattedActivityLogs = activityLogs.map(log => ({
            id: log._id,
            actor: {
                id: log.actorUserId?._id || log.actorUserId,
                name: log.actorName || (log.actorUserId ? `${log.actorUserId.firstName || ''} ${log.actorUserId.lastName || ''}`.trim() : ''),
                email: log.actorEmail,
                role: log.actorRole,
                profilePicture: log.actorUserId?.profilePicture || null
            },
            actionType: log.actionType,
            description: log.description,
            targetResource: log.targetResource,
            targetId: log.targetId,
            targetName: log.targetName,
            metadata: log.metadata || {},
            ipAddress: log.ipAddress,
            timestamp: log.timestamp
        }));

        // Merge all logs
        let allLogs = [...formattedActivityLogs, ...formattedAuditLogs, ...formattedMemoLogs];

        // Apply filters that weren't applied in queries
        // Note: actorRole filtering is already done at database level for AuditLog and Memo,
        // but we keep this as a safety check. Empty string means "All Roles" - show everything.
        if (req.query.actorRole && req.query.actorRole.trim() !== '' && ['admin', 'secretary', 'faculty'].includes(req.query.actorRole)) {
            allLogs = allLogs.filter(log => log.actor.role === req.query.actorRole);
        }
        if (req.query.actionType) {
            allLogs = allLogs.filter(log => log.actionType === req.query.actionType);
        }
        if (req.query.targetResource) {
            allLogs = allLogs.filter(log => log.targetResource === req.query.targetResource);
        }
        if (req.query.startDate || req.query.endDate) {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
            allLogs = allLogs.filter(log => {
                const logDate = new Date(log.timestamp);
                if (startDate && logDate < startDate) {return false;}
                if (endDate && logDate > endDate) {return false;}
                return true;
            });
        }
        if (req.query.search) {
            const searchLower = req.query.search.toLowerCase();
            allLogs = allLogs.filter(log =>
                log.description.toLowerCase().includes(searchLower) ||
                log.actor.name.toLowerCase().includes(searchLower) ||
                log.targetName.toLowerCase().includes(searchLower)
            );
        }

        // Sort by timestamp (newest first)
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Get total count
        const total = allLogs.length;

        // Apply pagination
        const logs = allLogs.slice(skip, skip + limit);

        // Logs are already formatted, just return them
        const formattedLogs = logs;

        res.json({
            success: true,
            logs: formattedLogs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ success: false, message: 'Error fetching activity logs' });
    }
};

/**
 * Get single activity log by ID
 * Admin only
 */
exports.getActivityLogById = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        const log = await ActivityLog.findById(req.params.id)
            .populate('actorUserId', 'firstName lastName email profilePicture')
            .lean();

        if (!log) {
            return res.status(404).json({ success: false, message: 'Activity log not found' });
        }

        res.json({
            success: true,
            log: {
                id: log._id,
                actor: {
                    id: log.actorUserId?._id || log.actorUserId,
                    name: log.actorName || (log.actorUserId ? `${log.actorUserId.firstName || ''} ${log.actorUserId.lastName || ''}`.trim() : ''),
                    email: log.actorEmail,
                    role: log.actorRole,
                    profilePicture: log.actorUserId?.profilePicture || null
                },
                actionType: log.actionType,
                description: log.description,
                targetResource: log.targetResource,
                targetId: log.targetId,
                targetName: log.targetName,
                metadata: log.metadata || {},
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
                timestamp: log.timestamp,
                createdAt: log.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching activity log:', error);
        res.status(500).json({ success: false, message: 'Error fetching activity log' });
    }
};

/**
 * Export activity logs as CSV
 * Admin only
 */
exports.exportActivityLogs = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        // Helper to convert internal actionType (e.g. "google_calendar_connected")
        // into a more readable label (e.g. "Google Calendar Connected")
        const formatActionLabel = (actionType) => {
            if (!actionType || typeof actionType !== 'string') {return '';}
            return actionType
                .split('_')
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
        };

        // Build filter (same as getActivityLogs)
        const filter = {};
        if (req.query.actorRole && ['admin', 'secretary', 'faculty'].includes(req.query.actorRole)) {
            filter.actorRole = req.query.actorRole;
        }
        if (req.query.actionType) {
            filter.actionType = req.query.actionType;
        }
        if (req.query.targetResource) {
            filter.targetResource = req.query.targetResource;
        }
        if (req.query.startDate || req.query.endDate) {
            filter.timestamp = {};
            if (req.query.startDate) {
                filter.timestamp.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                filter.timestamp.$lte = new Date(req.query.endDate);
            }
        }

        // Fetch all matching logs (no pagination for export)
        const logs = await ActivityLog.find(filter)
            .sort({ timestamp: -1 })
            .populate('actorUserId', 'firstName lastName email')
            .lean();

        // Generate CSV (human–readable headers + friendly action label)
        const csvRows = [];
        // Column order is optimized for readability in Excel:
        // Actor Name, Actor Email, Actor Role, Action Type, Action Label, Description, Target Resource, Target Name, IP Address
        csvRows.push([
            'Actor Name',
            'Actor Email',
            'Actor Role',
            'Action Type',
            'Action Label',
            'Description',
            'Target Resource',
            'Target Name',
            'IP Address'
        ].join(','));

        logs.forEach(log => {
            const actorName = log.actorName || (log.actorUserId ? `${log.actorUserId.firstName || ''} ${log.actorUserId.lastName || ''}`.trim() : '');
            const row = [
                `"${actorName.replace(/"/g, '""')}"`,
                `"${log.actorEmail.replace(/"/g, '""')}"`,
                log.actorRole,
                log.actionType,
                `"${formatActionLabel(log.actionType).replace(/"/g, '""')}"`,
                `"${log.description.replace(/"/g, '""')}"`,
                log.targetResource || '',
                `"${(log.targetName || '').replace(/"/g, '""')}"`,
                log.ipAddress || ''
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);
    } catch (error) {
        console.error('Error exporting activity logs:', error);
        res.status(500).json({ success: false, message: 'Error exporting activity logs' });
    }
};

/**
 * Get activity log statistics
 * Admin only
 */
exports.getActivityLogStats = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        // Build date filter if provided
        const dateFilter = {};
        if (req.query.startDate || req.query.endDate) {
            dateFilter.timestamp = {};
            if (req.query.startDate) {
                dateFilter.timestamp.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                dateFilter.timestamp.$lte = new Date(req.query.endDate);
            }
        }

        const [totalLogs, byRole, byActionType, byResource] = await Promise.all([
            ActivityLog.countDocuments(dateFilter),
            ActivityLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$actorRole', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            ActivityLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: '$actionType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            ActivityLog.aggregate([
                { $match: { ...dateFilter, targetResource: { $ne: null } } },
                { $group: { _id: '$targetResource', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                total: totalLogs,
                byRole: byRole.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                byActionType: byActionType.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                byResource: byResource.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Error fetching activity log stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching activity log statistics' });
    }
};

/**
 * Get autocomplete suggestions for search
 * Returns unique values from descriptions, actor names, and target names
 * Admin only
 */
exports.getSearchSuggestions = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        const query = req.query.q || '';
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '10', 10)));

        if (!query || query.length < 2) {
            return res.json({ success: true, suggestions: [] });
        }

        const searchRegex = { $regex: query, $options: 'i' };

        // Get suggestions from ActivityLog
        const [activityLogs, auditLogs] = await Promise.all([
            ActivityLog.find({
                $or: [
                    { description: searchRegex },
                    { actorName: searchRegex },
                    { targetName: searchRegex }
                ]
            })
                .select('description actorName targetName')
                .limit(100)
                .lean(),
            AuditLog.find({
                $or: [
                    { action: searchRegex },
                    { details: searchRegex }
                ]
            })
                .select('action details')
                .limit(100)
                .lean()
        ]);

        // Extract unique suggestions
        const suggestionsSet = new Set();

        // From ActivityLog
        activityLogs.forEach(log => {
            if (log.description && log.description.toLowerCase().includes(query.toLowerCase())) {
                // Extract relevant phrases from description
                const words = log.description.split(/\s+/);
                words.forEach((word, index) => {
                    if (word.toLowerCase().includes(query.toLowerCase()) && word.length >= 3) {
                        // Include the word and surrounding context
                        const start = Math.max(0, index - 1);
                        const end = Math.min(words.length, index + 2);
                        const phrase = words.slice(start, end).join(' ');
                        if (phrase.length <= 60) {
                            suggestionsSet.add(phrase);
                        }
                    }
                });
            }
            if (log.actorName && log.actorName.toLowerCase().includes(query.toLowerCase())) {
                suggestionsSet.add(log.actorName);
            }
            if (log.targetName && log.targetName.toLowerCase().includes(query.toLowerCase())) {
                suggestionsSet.add(log.targetName);
            }
        });

        // From AuditLog
        auditLogs.forEach(log => {
            if (log.action && log.action.toLowerCase().includes(query.toLowerCase())) {
                suggestionsSet.add(log.action);
            }
            if (log.details && typeof log.details === 'string' && log.details.toLowerCase().includes(query.toLowerCase())) {
                const words = log.details.split(/\s+/);
                words.forEach((word, index) => {
                    if (word.toLowerCase().includes(query.toLowerCase()) && word.length >= 3) {
                        const start = Math.max(0, index - 1);
                        const end = Math.min(words.length, index + 2);
                        const phrase = words.slice(start, end).join(' ');
                        if (phrase.length <= 60) {
                            suggestionsSet.add(phrase);
                        }
                    }
                });
            }
        });

        // Convert to array, sort by relevance (exact matches first, then by length)
        const suggestions = Array.from(suggestionsSet)
            .filter(s => s && s.trim().length > 0)
            .sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                const queryLower = query.toLowerCase();

                // Exact match at start gets priority
                if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) {return -1;}
                if (!aLower.startsWith(queryLower) && bLower.startsWith(queryLower)) {return 1;}

                // Then by length (shorter is better)
                return a.length - b.length;
            })
            .slice(0, limit);

        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({ success: false, message: 'Error fetching search suggestions' });
    }
};

