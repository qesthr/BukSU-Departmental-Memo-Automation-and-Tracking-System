const mongoose = require('mongoose');

/**
 * Activity Log Model
 * Tracks all system activities separate from notifications
 * Only memo and calendar events appear in notifications
 * All other activities go here
 */
const activityLogSchema = new mongoose.Schema({
    // Actor information
    actorUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    actorEmail: {
        type: String,
        required: true,
        index: true
    },
    actorRole: {
        type: String,
        enum: ['admin', 'secretary', 'faculty'],
        required: true,
        index: true
    },
    actorName: {
        type: String, // Cached name for faster queries
        default: ''
    },

    // Action details
    actionType: {
        type: String,
        required: true,
        index: true,
        enum: [
            // Memo actions (for activity log, not notifications)
            'memo_created',
            'memo_edited',
            'memo_archived',
            'memo_starred',
            'memo_unstarred',
            'memo_marked_read',
            'memo_attachment_uploaded',
            'memo_attachment_downloaded',
            'memo_approved',
            'memo_rejected',

            // Calendar actions (non-notification events)
            'calendar_event_created',
            'calendar_event_updated',
            'calendar_event_archived',

            // User management actions
            'user_created',
            'user_updated',
            'user_activated',
            'user_deactivated',
            'user_archived',
            'user_role_changed',
            'user_department_changed',
            'user_profile_updated',
            'user_profile_picture_uploaded',
            'user_lock_acquired',
            'user_lock_released',

            // Authentication actions
            'user_login',
            'user_logout',
            'password_reset_requested',
            'password_reset_completed',
            'password_updated',
            'welcome_email_sent',

            // Signature actions
            'signature_created',
            'signature_updated',
            'signature_archived',

            // System actions
            'settings_updated',
            'google_calendar_connected',
            'google_calendar_disconnected',
            'google_drive_backup_created',
            'report_exported',

            // File actions
            'file_uploaded',
            'file_downloaded'
        ]
    },

    // Description of the action
    description: {
        type: String,
        required: true
    },

    // Target resource information
    targetResource: {
        type: String,
        enum: ['memo', 'calendar_event', 'user', 'signature', 'file', 'settings', 'system'],
        index: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
        sparse: true // Not all actions have a target ID
    },
    targetName: {
        type: String, // Cached name for faster display
        default: ''
    },

    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Request information
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },

    // Timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Compound indexes for common queries
activityLogSchema.index({ actorRole: 1, timestamp: -1 });
activityLogSchema.index({ actionType: 1, timestamp: -1 });
activityLogSchema.index({ targetResource: 1, targetId: 1 });
activityLogSchema.index({ timestamp: -1 }); // Most common: recent logs first

// Text index for search functionality
activityLogSchema.index({ description: 'text', actorName: 'text', targetName: 'text' });

module.exports = mongoose.model('ActivityLog', activityLogSchema);

