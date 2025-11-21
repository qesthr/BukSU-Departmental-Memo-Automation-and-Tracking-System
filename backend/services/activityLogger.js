const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

/**
 * Activity Logger Service
 * Centralized logging for all system activities
 *
 * Usage:
 *   const activityLogger = require('../services/activityLogger');
 *   await activityLogger.log(req.user, 'memo_created', 'Created memo "Meeting Notes"', {
 *     targetResource: 'memo',
 *     targetId: memo._id,
 *     targetName: 'Meeting Notes'
 *   });
 */
class ActivityLogger {
    /**
     * Log an activity
     * @param {Object} user - User object (must have _id, email, role)
     * @param {String} actionType - Type of action (must be in enum)
     * @param {String} description - Human-readable description
     * @param {Object} options - Additional options
     * @param {String} options.targetResource - Resource type (memo, calendar_event, user, etc.)
     * @param {String|ObjectId} options.targetId - ID of the target resource
     * @param {String} options.targetName - Name of target resource (for display)
     * @param {Object} options.metadata - Additional metadata
     * @param {String} options.ipAddress - IP address of the request
     * @param {String} options.userAgent - User agent string
     */
    async log(user, actionType, description, options = {}) {
        try {
            // Validate user
            if (!user || !user._id) {
                console.warn('ActivityLogger: Invalid user provided');
                return;
            }

            // Get user name if not provided
            let actorName = options.actorName;
            if (!actorName && user.firstName && user.lastName) {
                actorName = `${user.firstName} ${user.lastName}`.trim();
            } else if (!actorName && user.email) {
                actorName = user.email;
            }

            // Get target name if targetId is provided but targetName is not
            let targetName = options.targetName || '';
            if (options.targetId && !targetName && options.targetResource) {
                try {
                    targetName = await this._getTargetName(options.targetResource, options.targetId);
                } catch (e) {
                    // Ignore errors - targetName will remain empty
                }
            }

            // Create log entry
            const logEntry = {
                actorUserId: user._id,
                actorEmail: user.email || '',
                actorRole: user.role || 'faculty',
                actorName: actorName || user.email || 'Unknown',
                actionType,
                description,
                targetResource: options.targetResource || null,
                targetId: options.targetId || null,
                targetName,
                metadata: options.metadata || {},
                ipAddress: options.ipAddress || '',
                userAgent: options.userAgent || '',
                timestamp: new Date()
            };

            // Save log (non-blocking)
            await ActivityLog.create(logEntry);

            // Log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.log(`[ActivityLog] ${actionType}: ${description} by ${actorName || user.email}`);
            }
        } catch (error) {
            // Never throw - logging should never break the main flow
            console.error('ActivityLogger error:', error);
        }
    }

    /**
     * Helper to get target resource name
     * @private
     */
    async _getTargetName(resourceType, resourceId) {
        try {
            switch (resourceType) {
                case 'memo':
                    const Memo = require('../models/Memo');
                    const memo = await Memo.findById(resourceId).select('subject').lean();
                    return memo?.subject || '';

                case 'calendar_event':
                    const CalendarEvent = require('../models/CalendarEvent');
                    const event = await CalendarEvent.findById(resourceId).select('title').lean();
                    return event?.title || '';

                case 'user':
                    const User = require('../models/User');
                    const user = await User.findById(resourceId).select('firstName lastName email').lean();
                    if (user) {
                        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                        return name || user.email || '';
                    }
                    return '';

                case 'signature':
                    const Signature = require('../models/Signature');
                    const signature = await Signature.findById(resourceId).select('displayName roleTitle').lean();
                    if (signature) {
                        return signature.displayName || signature.roleTitle || '';
                    }
                    return '';

                default:
                    return '';
            }
        } catch (e) {
            return '';
        }
    }

    /**
     * Log memo-related activity
     */
    async logMemoAction(user, actionType, memo, options = {}) {
        return this.log(user, actionType, options.description || `Memo "${memo.subject || memo._id}" ${actionType}`, {
            targetResource: 'memo',
            targetId: memo._id,
            targetName: memo.subject || '',
            ...options
        });
    }

    /**
     * Log calendar event activity
     */
    async logCalendarAction(user, actionType, event, options = {}) {
        return this.log(user, actionType, options.description || `Calendar event "${event.title || event._id}" ${actionType}`, {
            targetResource: 'calendar_event',
            targetId: event._id,
            targetName: event.title || '',
            ...options
        });
    }

    /**
     * Log user management activity
     */
    async logUserAction(user, actionType, targetUser, options = {}) {
        const targetUserName = targetUser
            ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email
            : options.targetName || 'Unknown User';

        return this.log(user, actionType, options.description || `User "${targetUserName}" ${actionType}`, {
            targetResource: 'user',
            targetId: targetUser?._id || options.targetId,
            targetName: targetUserName,
            ...options
        });
    }

    /**
     * Log authentication activity
     */
    async logAuthAction(user, actionType, description, options = {}) {
        return this.log(user, actionType, description, {
            targetResource: 'system',
            ...options
        });
    }

    /**
     * Extract IP and User-Agent from Express request
     */
    extractRequestInfo(req) {
        return {
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || '',
            userAgent: req.headers['user-agent'] || ''
        };
    }
}

// Export singleton instance
module.exports = new ActivityLogger();

