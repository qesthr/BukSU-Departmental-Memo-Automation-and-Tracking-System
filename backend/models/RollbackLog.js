// Rollback Log Model - Tracks operations that can be rolled back

const mongoose = require('mongoose');

const rollbackLogSchema = new mongoose.Schema({
  operationId: {
    type: String,
    required: true,
    index: true
  },
  operationType: {
    type: String,
    enum: ['memo_approval', 'memo_rejection', 'memo_deletion', 'user_deletion', 'calendar_event_creation'],
    required: true,
    index: true
  },
  beforeState: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  afterState: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['completed', 'rolled_back'],
    default: 'completed',
    index: true
  },
  rolledBackBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rolledBackAt: {
    type: Date
  },
  rollbackReason: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
rollbackLogSchema.index({ operationType: 1, status: 1 });
rollbackLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('RollbackLog', rollbackLogSchema);

