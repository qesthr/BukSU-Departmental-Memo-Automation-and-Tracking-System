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
    // Store a single pending record owned by secretary; keep all intended recipients in `recipients`
    recipient: user._id,
    recipients: payload.recipients,
    subject: payload.subject,
    content: payload.content || '',
    department: payload.department || user.department,
    departments: Array.isArray(payload.departments) ? payload.departments : (payload.departments ? [payload.departments] : []),
    priority: payload.priority || 'medium',
    attachments: payload.attachments || [],
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
  // Mark approval in history; avoid setting a status not allowed by schema
  await appendHistory(memo, adminUser, 'approved');
  await notifySecretary({ memo, actor: adminUser, action: 'approved' });
  await deliver({ memo, actor: adminUser });
  await archivePendingAdminNotifications(memoId);
  // Remove the original pending memo document after successful delivery
  try {
    await Memo.deleteOne({ _id: memoId });
    // Also remove any legacy per-recipient pending copies that may linger
    await Memo.deleteMany({ status: 'pending', sender: memo.sender, subject: memo.subject });
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
  // Record rejection without assigning an enum value that schema may not allow
  await appendHistory(memo, adminUser, 'rejected', reason);
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
  // Determine recipients
  let recipientIds = Array.isArray(memo.recipients) ? memo.recipients.slice() : [];
  // If no explicit recipients, derive from department(s)
  if (!recipientIds || recipientIds.length === 0) {
    const deptList = Array.isArray(memo.departments) && memo.departments.length
      ? memo.departments
      : (memo.department ? [memo.department] : []);
    if (deptList.length > 0) {
      const faculty = await User.find({ role: 'faculty', department: { $in: deptList } }).select('_id');
      recipientIds = faculty.map(u => u._id);
    }
  }

  // Exclude the secretary/sender themselves from delivery
  const senderIdStr = String(memo.sender || (actor && actor._id) || '');
  const finalRecipients = (recipientIds || []).filter(r => String(r) !== senderIdStr);

  // Create recipient memos
  const createOps = finalRecipients.map(r => new Memo({
    sender: memo.sender,
    recipient: r,
    subject: memo.subject,
    content: memo.content || '',
    department: memo.department,
    departments: memo.departments,
    recipients: finalRecipients,
    priority: memo.priority || 'medium',
    createdBy: memo.createdBy || memo.sender,
    attachments: memo.attachments || [],
    status: MEMO_STATUS.SENT,
    folder: MEMO_STATUS.SENT,
    metadata: { originalMemoId: memo._id.toString(), eventType: 'memo_delivered' }
  }).save());
  await Promise.all(createOps);

  // Mark workflow memo as sent in history (it may be deleted by caller later)
  memo.status = MEMO_STATUS.SENT;
  await appendHistory(memo, actor, 'sent');
  await memo.save();
  return memo;
}

module.exports = { createBySecretary, approve, reject, deliver, appendHistory };


