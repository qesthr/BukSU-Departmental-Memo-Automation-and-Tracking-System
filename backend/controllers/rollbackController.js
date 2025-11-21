// Rollback Controller - Handles rollback operations
// These endpoints are NEW and don't affect existing functionality

const { manualRollback } = require('../services/rollbackService');
const RollbackLog = require('../models/RollbackLog');
const isAdmin = require('../middleware/isAdmin');

/**
 * Get rollback logs for a specific operation type
 * GET /api/rollback/logs?operationType=memo_approval&status=completed
 */
exports.getRollbackLogs = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { operationType, status, limit = 50 } = req.query;
    const query = {};

    if (operationType) {
      query.operationType = operationType;
    }

    if (status) {
      query.status = status;
    }

    const logs = await RollbackLog.find(query)
      .populate('performedBy', 'firstName lastName email')
      .populate('rolledBackBy', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching rollback logs:', error);
    res.status(500).json({ success: false, message: 'Error fetching rollback logs', error: error.message });
  }
};

/**
 * Get a specific rollback log by ID
 * GET /api/rollback/logs/:id
 */
exports.getRollbackLog = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { id } = req.params;
    const log = await RollbackLog.findById(id)
      .populate('performedBy', 'firstName lastName email')
      .populate('rolledBackBy', 'firstName lastName email');

    if (!log) {
      return res.status(404).json({ success: false, message: 'Rollback log not found' });
    }

    res.json({ success: true, log });
  } catch (error) {
    console.error('Error fetching rollback log:', error);
    res.status(500).json({ success: false, message: 'Error fetching rollback log', error: error.message });
  }
};

/**
 * Manually rollback an operation
 * POST /api/rollback/:id
 */
exports.rollbackOperation = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const result = await manualRollback(id, req.user._id);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    // Update rollback reason if provided
    if (reason) {
      await RollbackLog.findByIdAndUpdate(id, { rollbackReason: reason });
    }

    res.json({
      success: true,
      message: 'Operation rolled back successfully',
      result: result.result
    });
  } catch (error) {
    console.error('Error rolling back operation:', error);
    res.status(500).json({ success: false, message: 'Error rolling back operation', error: error.message });
  }
};

/**
 * Get available rollback operations (operations that can be rolled back)
 * GET /api/rollback/available
 */
exports.getAvailableRollbacks = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { operationType, hours = 24 } = req.query;

    const query = {
      status: 'completed',
      timestamp: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) }
    };

    if (operationType) {
      query.operationType = operationType;
    }

    const availableRollbacks = await RollbackLog.find(query)
      .populate('performedBy', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      success: true,
      count: availableRollbacks.length,
      rollbacks: availableRollbacks
    });
  } catch (error) {
    console.error('Error fetching available rollbacks:', error);
    res.status(500).json({ success: false, message: 'Error fetching available rollbacks', error: error.message });
  }
};

