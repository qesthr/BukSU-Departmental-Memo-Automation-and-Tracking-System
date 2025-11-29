// Lightweight notification helpers using Memo model (non-breaking)

const Memo = require('../models/Memo');
const activityLogger = require('./activityLogger');

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
    if (!secretaryId) {return;}
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

    // Ensure actor (admin) is provided - this is required for rejection/approval notifications
    if (!actor || !actor._id) {
      console.error('notifySecretary: actor (admin) is required for rejection/approval notifications');
      return;
    }

    await new Memo({
      sender: actor._id, // Admin who performed the action (approve/reject) - REQUIRED
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
    if (recipients.length === 0) {return;}
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

async function archivePendingAdminNotifications(originalMemoId, session = null) {
  try {
    if (!originalMemoId) {return;}
    const updateOptions = session ? { session } : {};
    const res = await Memo.updateMany(
      {
        'metadata.relatedMemoId': String(originalMemoId),
        'metadata.eventType': 'memo_pending_review'
      },
      { $set: { status: 'archived', folder: 'archived' } },
      updateOptions
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

async function notifyCalendarConnected({ user, req }) {
  // Log Google Calendar connection as an activity log ONLY (no memo/inbox entry)
  try {
    if (!user || !user._id) {
      return;
    }

    const userName =
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.email ||
      'User';

    // Extract request info if available (for IP / User-Agent)
    const requestInfo = req
      ? activityLogger.extractRequestInfo(req)
      : {};

    await activityLogger.log(
      user,
      'google_calendar_connected',
      `${userName} connected Google Calendar`,
      {
        targetResource: 'system',
        metadata: {
          userEmail: user.email || '',
          source: 'google_calendar_oauth'
        },
        ...requestInfo
      }
    );
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


