const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, index: true },
    action: { type: String, required: true },
    subject: { type: String, default: 'User Activity' },
    message: { type: String, default: '' },
    metadata: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);


