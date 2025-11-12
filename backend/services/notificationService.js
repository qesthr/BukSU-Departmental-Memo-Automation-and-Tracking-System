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

async function notifyUserProfileEdited({ editedUser, adminUser }) {
  // Notify the user whose profile was edited
  // Also notify the admin who made the edit
  try {
    const User = require('../models/User');
    const adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || adminUser.email || 'An admin';
    const editedUserName = `${editedUser.firstName || ''} ${editedUser.lastName || ''}`.trim() || editedUser.email || 'User';

    // Notify the user being edited
    await new Memo({
      sender: adminUser._id,
      recipient: editedUser._id,
      subject: 'Your profile has been updated',
      content: `${adminName} has updated your profile information.`,
      activityType: 'user_profile_edited',
      priority: 'medium',
      status: 'sent',
      metadata: {
        eventType: 'user_profile_edited',
        editedBy: adminUser._id?.toString?.() || String(adminUser._id || ''),
        editedByEmail: adminUser.email || ''
      }
    }).save();

    // Notify the admin who made the edit
    await new Memo({
      sender: adminUser._id,
      recipient: adminUser._id,
      subject: `User profile updated: ${editedUserName}`,
      content: `You have updated the profile of ${editedUserName} (${editedUser.email || 'N/A'}).`,
      activityType: 'user_profile_edited',
      priority: 'medium',
      status: 'sent',
      metadata: {
        eventType: 'user_profile_edited',
        editedUserId: editedUser._id?.toString?.() || String(editedUser._id || ''),
        editedUserEmail: editedUser.email || ''
      }
    }).save();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('notifyUserProfileEdited error:', e?.message || e);
  }
}

async function notifyCalendarConnected({ user }) {
  // Notify the user that they successfully connected their Google Calendar
  try {
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';

    await new Memo({
      sender: user._id,
      recipient: user._id,
      subject: 'Google Calendar Connected',
      content: `You have successfully connected your Google Calendar account (${user.email || 'N/A'}) to Memofy. Your calendar events will now sync automatically.`,
      activityType: 'calendar_connected',
      priority: 'medium',
      status: 'sent',
      metadata: {
        eventType: 'calendar_connected',
        userEmail: user.email || ''
      }
    }).save();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('notifyCalendarConnected error:', e?.message || e);
  }
}

module.exports = {
  notifyAdmin,
  notifySecretary,
  notifyRecipients,
  archivePendingAdminNotifications,
  notifyUserProfileEdited,
  notifyCalendarConnected
};


