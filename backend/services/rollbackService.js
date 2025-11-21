// Rollback Service - Safe transaction management for critical operations
// This service adds rollback functionality WITHOUT breaking existing code

const mongoose = require('mongoose');

/**
 * Execute an operation within a MongoDB transaction
 * If any step fails, all changes are automatically rolled back
 *
 * @param {Function} operation - Async function that performs the operation
 * @returns {Promise} Result of the operation
 */
async function executeWithRollback(operation) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Execute the operation with session context
    const result = await operation(session);

    // If successful, commit the transaction
    await session.commitTransaction();
    return { success: true, result };
  } catch (error) {
    // If any error occurs, rollback automatically
    await session.abortTransaction();
    // eslint-disable-next-line no-console
    console.error('Transaction rolled back due to error:', error.message);
    return { success: false, error: error.message, rolledBack: true };
  } finally {
    // Always end the session
    session.endSession();
  }
}

/**
 * Store rollback metadata for an operation
 * This allows manual rollback later if needed
 */
async function storeRollbackMetadata(operationId, operationType, beforeState, afterState, userId) {
  const RollbackLog = require('../models/RollbackLog');

  try {
    await RollbackLog.create({
      operationId,
      operationType,
      beforeState,
      afterState,
      performedBy: userId,
      timestamp: new Date(),
      status: 'completed'
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to store rollback metadata:', error);
    // Don't throw - metadata storage failure shouldn't break the operation
  }
}

/**
 * Manual rollback for a specific operation
 * Uses stored metadata to restore previous state
 */
async function manualRollback(rollbackLogId, userId) {
  const RollbackLog = require('../models/RollbackLog');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rollbackLog = await RollbackLog.findById(rollbackLogId).session(session);

    if (!rollbackLog) {
      throw new Error('Rollback log not found');
    }

    if (rollbackLog.status === 'rolled_back') {
      throw new Error('This operation has already been rolled back');
    }

    // Perform rollback based on operation type
    let rollbackResult;
    switch (rollbackLog.operationType) {
      case 'memo_approval':
        rollbackResult = await rollbackMemoApproval(rollbackLog, session);
        break;
      case 'memo_rejection':
        rollbackResult = await rollbackMemoRejection(rollbackLog, session);
        break;
      case 'memo_deletion':
        rollbackResult = await rollbackMemoDeletion(rollbackLog, session);
        break;
      default:
        throw new Error(`Unsupported rollback type: ${rollbackLog.operationType}`);
    }

    // Mark rollback log as rolled back
    rollbackLog.status = 'rolled_back';
    rollbackLog.rolledBackBy = userId;
    rollbackLog.rolledBackAt = new Date();
    await rollbackLog.save({ session });

    await session.commitTransaction();
    return { success: true, result: rollbackResult };
  } catch (error) {
    await session.abortTransaction();
    // eslint-disable-next-line no-console
    console.error('Manual rollback failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    session.endSession();
  }
}

/**
 * Rollback memo approval - restore to pending status
 */
async function rollbackMemoApproval(rollbackLog, session) {
  const Memo = require('../models/Memo');
  const CalendarEvent = require('../models/CalendarEvent');

  const beforeState = rollbackLog.beforeState;
  const afterState = rollbackLog.afterState;

  // Restore original memo status
  if (beforeState.originalMemo) {
    await Memo.findByIdAndUpdate(
      beforeState.originalMemo._id,
      {
        status: beforeState.originalMemo.status,
        folder: beforeState.originalMemo.folder
      },
      { session }
    );
  }

  // Delete recipient memos that were created
  if (afterState.recipientMemos && afterState.recipientMemos.length > 0) {
    const recipientMemoIds = afterState.recipientMemos.map(m => m._id);
    await Memo.deleteMany({ _id: { $in: recipientMemoIds } }, { session });
  }

  // Delete calendar events that were created
  if (afterState.calendarEvents && afterState.calendarEvents.length > 0) {
    const calendarEventIds = afterState.calendarEvents.map(e => e._id);
    await CalendarEvent.deleteMany({ _id: { $in: calendarEventIds } }, { session });
  }

  return { message: 'Memo approval rolled back successfully' };
}

/**
 * Rollback memo rejection - restore to pending status
 */
async function rollbackMemoRejection(rollbackLog, session) {
  const Memo = require('../models/Memo');
  const { MEMO_STATUS } = require('./memoStatus');

  const beforeState = rollbackLog.beforeState;

  if (beforeState.memo) {
    await Memo.findByIdAndUpdate(
      beforeState.memo._id,
      {
        status: MEMO_STATUS.PENDING_ADMIN,
        folder: 'drafts'
      },
      { session }
    );
  }

  return { message: 'Memo rejection rolled back successfully' };
}

/**
 * Rollback memo deletion - restore deleted memo
 */
async function rollbackMemoDeletion(rollbackLog, session) {
  const Memo = require('../models/Memo');

  const beforeState = rollbackLog.beforeState;

  if (beforeState.memo) {
    await Memo.findByIdAndUpdate(
      beforeState.memo._id,
      {
        status: beforeState.memo.status,
        folder: beforeState.memo.folder
      },
      { session }
    );
  }

  return { message: 'Memo deletion rolled back successfully' };
}

module.exports = {
  executeWithRollback,
  storeRollbackMetadata,
  manualRollback
};

