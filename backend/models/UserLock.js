const mongoose = require('mongoose');

const userLockSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lockTime: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true }
});

// TTL-like behavior via index is supported if we set expiresAfterSeconds
// But we want dynamic 30s sliding expiration, so we manage expiresAt updates.

const UserLock = mongoose.model('UserLock', userLockSchema);

module.exports = UserLock;


