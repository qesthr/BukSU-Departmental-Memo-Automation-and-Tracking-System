// Lightweight notification helpers using Memo model (non-breaking)

const Memo = require('../models/Memo');

async function notifyAdmin({ memo, actor }) {
  // Send a system notification to all admins that a memo is pending review
  try {
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    const ops = admins.map(a => new Memo({
      sender: actor?._id || memo.sender,
      recipient: a._id,
      subject: `Memo pending approval: ${memo.subject}`,
      content: `A memo from ${actor?.email || 'a secretary'} is awaiting approval. Subject: ${memo.subject}`,
      activityType: 'system_notification',
      priority: 'medium',
      status: 'sent',
      metadata: {
        relatedMemoId: memo._id?.toString?.() || String(memo._id || ''),
        eventType: 'memo_pending_review'
      }
    }).save());
    await Promise.all(ops);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('notifyAdmin error:', e?.message || e);
  }
}

async function notifySecretary({ memo, actor, action, reason }) {
  try {
    const secretaryId = memo.sender; // original author
    if (!secretaryId) return;
    const clean = (s) => String(s || '').replace(/^\s*Memo\s+Pending\s+Approval:\s*/i, '').trim();

    let subject, content;
    if (action === 'pending') {
      subject = `Memo Pending Approval: ${clean(memo.subject)}`;
      content = `Your memo "${memo.subject}" has been submitted and is pending admin approval.`;
    } else if (action === 'approved') {
      subject = `Memo Approved: ${clean(memo.subject)}`;
      content = `Your memo "${memo.subject}" was approved by ${actor?.email || 'an admin'} and has been sent to recipients.`;
    } else if (action === 'rejected') {
      subject = `Memo Rejected: ${clean(memo.subject)}`;
      content = `Your memo "${memo.subject}" was rejected by ${actor?.email || 'an admin'}${reason ? `\nReason: ${reason}` : ''}`;
    } else {
      return; // Unknown action
    }

    await new Memo({
      sender: actor?._id || secretaryId,
      recipient: secretaryId,
      subject,
      content,
      activityType: 'system_notification',
      priority: 'medium',
      status: 'sent',
      metadata: {
        relatedMemoId: memo._id?.toString?.() || String(memo._id || ''),
        eventType: 'memo_review_decision',
        action,
        reason: reason || ''
      }
    }).save();
  } catch (e) {
    console.error('notifySecretary error:', e?.message || e);
  }
}

async function notifyRecipients({ memo, actor }) {
  try {
    const recipients = Array.isArray(memo.recipients) && memo.recipients.length
      ? memo.recipients
      : (memo.recipient ? [memo.recipient] : []);
    if (recipients.length === 0) return;
    const ops = recipients.map(r => new Memo({
      sender: actor?._id || memo.sender,
      recipient: r,
      subject: memo.subject,
      content: memo.content || '',
      department: memo.department,
      priority: memo.priority || 'medium',
      status: 'sent',
      metadata: { relatedMemoId: memo._id?.toString?.() || String(memo._id || '') }
    }).save());
    await Promise.all(ops);
  } catch (e) {
    console.error('notifyRecipients error:', e?.message || e);
  }
}

async function archivePendingAdminNotifications(originalMemoId) {
  try {
    if (!originalMemoId) return;
    const res = await Memo.updateMany(
      {
        'metadata.relatedMemoId': String(originalMemoId),
        'metadata.eventType': 'memo_pending_review'
      },
      { $set: { status: 'archived', folder: 'archived' } }
    );
    // eslint-disable-next-line no-console
    console.log(`Archived ${res.modifiedCount || 0} pending admin notifications for memo ${originalMemoId}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('archivePendingAdminNotifications error:', e?.message || e);
  }
}

module.exports = { notifyAdmin, notifySecretary, notifyRecipients, archivePendingAdminNotifications };


