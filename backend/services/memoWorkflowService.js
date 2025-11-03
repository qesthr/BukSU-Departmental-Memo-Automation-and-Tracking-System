// Memo workflow utilities (not wired yet) — safe to keep alongside current logic

const Memo = require('../models/Memo');
const User = require('../models/User');
const { MEMO_STATUS } = require('./memoStatus');
const { notifyAdmin, notifySecretary, notifyRecipients, archivePendingAdminNotifications } = require('./notificationService');
const googleDriveService = require('../services/googleDriveService');

async function appendHistory(memo, actor, action, reason) {
  const history = Array.isArray(memo.metadata?.history) ? memo.metadata.history : [];
  history.push({ at: new Date(), by: { _id: actor?._id, email: actor?.email }, action, reason: reason || '' });
  memo.metadata = Object.assign({}, memo.metadata, { history });
  return memo;
}

async function createBySecretary({ user, payload }) {
  // Create memo as PENDING_ADMIN; do not alter existing external contracts
  const memo = new Memo({
    sender: user._id,
    recipient: payload.recipient,
    recipients: payload.recipients,
    subject: payload.subject,
    content: payload.content || '',
    department: payload.department || user.department,
    priority: payload.priority || 'medium',
    status: MEMO_STATUS.PENDING_ADMIN,
    folder: 'drafts',
    metadata: Object.assign({}, payload.metadata)
  });
  await appendHistory(memo, user, 'created');
  await memo.save();
  await notifyAdmin({ memo, actor: user });
  return memo;
}

async function approve({ memoId, adminUser }) {
  const memo = await Memo.findById(memoId);
  if (!memo) throw new Error('Memo not found');
  memo.status = MEMO_STATUS.APPROVED;
  await appendHistory(memo, adminUser, 'approved');
  await memo.save();
  await notifySecretary({ memo, actor: adminUser, action: 'approved' });
  await deliver({ memo, actor: adminUser });
  await archivePendingAdminNotifications(memoId);
  // Remove the original pending memo document after successful delivery
  try {
    await Memo.deleteOne({ _id: memoId });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to delete original pending memo after approval:', e?.message || e);
  }

  // Fire-and-forget Google Drive backup of the approved memo
  try {
    // Do not block the response; log result asynchronously
    googleDriveService.uploadMemoToDrive(memo)
      .then((driveFileId) => {
        // eslint-disable-next-line no-console
        console.log(`✅ Approved memo backed up to Google Drive: ${driveFileId}`);
      })
      .catch((backupError) => {
        // eslint-disable-next-line no-console
        console.error('⚠️ Google Drive backup failed after approval:', backupError?.message || backupError);
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Drive backup trigger error (approval):', e?.message || e);
  }
  return memo;
}

async function reject({ memoId, adminUser, reason }) {
  const memo = await Memo.findById(memoId);
  if (!memo) throw new Error('Memo not found');
  memo.status = MEMO_STATUS.REJECTED;
  await appendHistory(memo, adminUser, 'rejected', reason);
  await memo.save();
  await notifySecretary({ memo, actor: adminUser, action: 'rejected', reason });
  await archivePendingAdminNotifications(memoId);
  // Remove the original pending memo document after rejection
  try {
    await Memo.deleteOne({ _id: memoId });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to delete original pending memo after rejection:', e?.message || e);
  }
  return memo;
}

async function deliver({ memo, actor }) {
  // Create recipient-facing memos and mark original as SENT
  await notifyRecipients({ memo, actor });
  memo.status = MEMO_STATUS.SENT;
  await appendHistory(memo, actor, 'sent');
  await memo.save();
  return memo;
}

module.exports = { createBySecretary, approve, reject, deliver, appendHistory };


