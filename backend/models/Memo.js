const mongoose = require('mongoose');

const memoSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        trim: true
    },
    content: {
        type: String,
        required: false, // Allow empty content (memos can be sent with just attachments)
        default: '',
        trim: true
    },
    department: {
        type: String,
        trim: true
    },
    departments: [{
        type: String,
        trim: true
    }],
    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    htmlContent: {
        type: String
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'sent', 'read', 'archived', 'deleted'],
        default: 'sent'
    },
    activityType: {
        type: String,
        enum: [
            'memo_sent',
            'memo_received',
            'pending_memo',
            'memo_approved',
            'memo_rejected',
            'password_reset',
            'welcome_email',
            'user_activity',
            'system_notification',
            'user_deleted',
            null
        ],
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isStarred: {
        type: Boolean,
        default: false
    },
    isRead: {
        type: Boolean,
        default: false
    },
    attachments: [{
        filename: String,
        path: String,
        url: String, // Direct URL to access the file
        size: Number,
        mimetype: String
    }],
    googleDriveFileId: {
        type: String,
        sparse: true
    },
    readAt: {
        type: Date
    },
    folder: {
        type: String,
        enum: ['inbox', 'sent', 'drafts', 'starred', 'deleted'],
        default: 'sent'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt before saving
memoSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Create indexes for better query performance
memoSchema.index({ activityType: 1 });
memoSchema.index({ sender: 1, activityType: 1 });
memoSchema.index({ recipient: 1, activityType: 1 });

// Index for faster queries
memoSchema.index({ sender: 1, folder: 1 });
memoSchema.index({ recipient: 1, folder: 1 });
memoSchema.index({ isStarred: 1 });
memoSchema.index({ status: 1 });
memoSchema.index({ createdBy: 1, createdAt: -1 });

const Memo = mongoose.model('Memo', memoSchema);

module.exports = Memo;

