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
  // Store as a single document - secretary is the sender but NOT the recipient
  // The recipient field is set to sender for tracking, but secretary won't receive the actual memo
  const memo = new Memo({
    sender: user._id,
    // Store a single pending record owned by secretary; keep all intended recipients in `recipients`
    // Set recipient to sender for tracking purposes, but secretary will only get notifications
    recipient: user._id,
    recipients: payload.recipients,
    subject: payload.subject,
    content: payload.content || '',
    department: payload.department || user.department,
    departments: Array.isArray(payload.departments) ? payload.departments : (payload.departments ? [payload.departments] : []),
    priority: payload.priority || 'medium',
    attachments: payload.attachments || [],
    signatures: payload.signatures || [],
    template: payload.template || 'none',
    status: MEMO_STATUS.PENDING_ADMIN,
    folder: 'drafts',
    metadata: Object.assign({}, payload.metadata)
  });
  await appendHistory(memo, user, 'created');
  await memo.save();

  // Notify admin that memo is pending
  await notifyAdmin({ memo, actor: user });

  // Notify secretary that memo is pending (notification only, not the actual memo)
  await notifySecretary({ memo, actor: user, action: 'pending' });

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

  // Keep the original pending memo for audit; mark as APPROVED
  try {
    memo.status = MEMO_STATUS.APPROVED;
    memo.folder = 'drafts';
    await memo.save();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to update original memo after approval:', e?.message || e);
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
  // Record rejection and keep the record
  await appendHistory(memo, adminUser, 'rejected', reason);
  await notifySecretary({ memo, actor: adminUser, action: 'rejected', reason });
  await archivePendingAdminNotifications(memoId);

  // Keep the original pending memo; mark as REJECTED
  try {
    memo.status = MEMO_STATUS.REJECTED;
    memo.folder = 'drafts';
    await memo.save();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to update original memo after rejection:', e?.message || e);
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
      // Only get faculty members (not secretaries or admins)
      const faculty = await User.find({ role: 'faculty', department: { $in: deptList }, isActive: true }).select('_id');
      recipientIds = faculty.map(u => u._id);
    }
  }

  // Exclude the secretary/sender themselves from delivery
  const senderIdStr = String(memo.sender || (actor && actor._id) || '');
  const finalRecipients = (recipientIds || []).filter(r => String(r) !== senderIdStr);

  // Also exclude any secretaries - memos are only for faculty
  const recipientUsers = await User.find({ _id: { $in: finalRecipients } }).select('_id role');
  const facultyRecipients = recipientUsers
    .filter(u => u.role === 'faculty')
    .map(u => u._id);

  // Deduplicate recipients array to prevent duplicates
  const uniqueRecipients = [...new Set(facultyRecipients.map(r => String(r)))];

  if (uniqueRecipients.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('No faculty recipients found for memo delivery');
    return memo;
  }

  // Check for existing memos to prevent duplicates
  const originalMemoId = memo._id.toString();
  const existingMemos = await Memo.find({
    'metadata.originalMemoId': originalMemoId,
    recipient: { $in: uniqueRecipients },
    status: { $in: ['sent', 'approved', 'read'] }
  }).select('recipient').lean();

  const existingRecipientIds = new Set(
    existingMemos.map(m => String(m.recipient))
  );

  // Only create memos for recipients who don't already have one
  const recipientsToCreate = uniqueRecipients.filter(
    r => !existingRecipientIds.has(String(r))
  );

  if (recipientsToCreate.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`All recipients already have memos for originalMemoId: ${originalMemoId}`);
    return memo;
  }

  // Create recipient memos - one memo per faculty recipient
  // This is necessary for individual inbox tracking
  // These memos serve as notifications to recipients
  const createOps = recipientsToCreate.map(r => new Memo({
    sender: memo.sender,
    recipient: r,
    subject: memo.subject,
    content: memo.content || '',
    htmlContent: memo.htmlContent || '',
    department: memo.department,
    departments: memo.departments,
    recipients: uniqueRecipients, // All recipients list
    priority: memo.priority || 'medium',
    createdBy: memo.createdBy || memo.sender,
    attachments: memo.attachments || [],
    signatures: memo.signatures || [],
    template: memo.template || 'none',
    status: MEMO_STATUS.SENT,
    folder: MEMO_STATUS.SENT,
    isRead: false, // Mark as unread so recipients see it as a new notification
    metadata: {
      originalMemoId: originalMemoId,
      eventType: 'memo_delivered',
      approvedAt: new Date().toISOString(),
      approvedBy: actor?._id?.toString() || String(actor?._id || '')
    }
  }).save());
  const createdMemos = await Promise.all(createOps);

  // Log notification to recipients
  console.log(`✅ Notified ${createdMemos.length} recipients about approved memo: ${memo.subject}`);

  // Create calendar event if date/time is in memo metadata (for secretary-created memos)
  if (memo.metadata && memo.metadata.eventDate && createdMemos.length > 0) {
    try {
      const CalendarEvent = require('../models/CalendarEvent');
      const { eventDate, eventTime, allDay } = memo.metadata;

      // Parse date and time
      const isAllDay = allDay === true || allDay === 'true';
      let startDate, endDate;

      if (isAllDay) {
        startDate = new Date(eventDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(eventDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (eventTime) {
        const [hours, minutes] = eventTime.split(':');
        startDate = new Date(eventDate);
        startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
      } else {
        startDate = new Date(eventDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(eventDate);
        endDate.setHours(23, 59, 59, 999);
      }

      // Get recipient emails and departments
      const recipientEmails = [];
      const recipientDepartments = new Set();
      const recipientUsers = await User.find({ _id: { $in: finalRecipients } }).select('email department').lean();
      recipientUsers.forEach(ru => {
        if (ru.email) recipientEmails.push(ru.email.toLowerCase());
        if (ru.department) recipientDepartments.add(ru.department);
      });

      // Add departments from memo
      if (memo.departments && Array.isArray(memo.departments)) {
        memo.departments.forEach(dept => {
          if (dept) recipientDepartments.add(dept);
        });
      }

      // Map priority to category
      const categoryMap = {
        'urgent': 'urgent',
        'high': 'high',
        'medium': 'standard',
        'low': 'low'
      };
      const category = categoryMap[memo.priority] || 'standard';

      // Create calendar event
      const calendarEvent = new CalendarEvent({
        title: memo.subject.trim(),
        start: startDate,
        end: endDate,
        allDay: isAllDay,
        category: category,
        description: memo.content || '',
        participants: {
          emails: [...new Set(recipientEmails)],
          departments: Array.from(recipientDepartments)
        },
        memoId: createdMemos[0]._id,
        createdBy: memo.createdBy || memo.sender,
        status: 'scheduled'
      });

      await calendarEvent.save();

      // Update memo with calendar event reference
      await Memo.findByIdAndUpdate(createdMemos[0]._id, {
        'metadata.calendarEventId': calendarEvent._id,
        'metadata.hasCalendarEvent': true
      });

      console.log(`✅ Calendar event created for approved memo: ${memo.subject} (Event ID: ${calendarEvent._id})`);
    } catch (calendarError) {
      console.error('⚠️ Failed to create calendar event for approved memo:', calendarError.message);
    }
  }

  // Mark workflow memo as approved (not sent) and persist history
  memo.status = MEMO_STATUS.APPROVED;
  await appendHistory(memo, actor, 'sent');
  await memo.save();
  return memo;
}

module.exports = { createBySecretary, approve, reject, deliver, appendHistory };


