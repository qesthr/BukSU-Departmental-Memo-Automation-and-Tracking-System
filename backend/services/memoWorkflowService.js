// Memo workflow utilities (not wired yet) — safe to keep alongside current logic

const Memo = require('../models/Memo');
const User = require('../models/User');
const { MEMO_STATUS } = require('./memoStatus');
const { notifyAdmin, notifySecretary, notifyRecipients, archivePendingAdminNotifications } = require('./notificationService');
const googleDriveService = require('../services/googleDriveService');
const { executeWithRollback, storeRollbackMetadata } = require('./rollbackService');

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
  if (!memo) {throw new Error('Memo not found');}

  // Check if memo has already been approved or rejected by another admin
  if (memo.status === 'approved' || memo.status === 'rejected') {
    // Check if this admin already acted on it
    const hasAdminAction = memo.metadata?.history?.some(h =>
      (h.by?._id?.toString() === adminUser._id.toString() ||
       h.by?.toString() === adminUser._id.toString()) &&
      (h.action === 'approved' || h.action === 'rejected')
    );

    if (!hasAdminAction) {
      throw new Error('This memo has already been processed by another admin.');
    }
  }

  // Mark approval in history; avoid setting a status not allowed by schema
  await appendHistory(memo, adminUser, 'approved');
  await notifySecretary({ memo, actor: adminUser, action: 'approved' });
  const deliverResult = await deliver({ memo, actor: adminUser });
  await archivePendingAdminNotifications(memoId);

  // Keep the original pending memo for audit; mark as APPROVED
  // Set folder to 'sent' so it appears in admin inbox
  try {
    memo.status = MEMO_STATUS.APPROVED;
    memo.folder = 'sent';
    await memo.save();

    // Create a memo entry for admin so it appears in their inbox
    const adminMemo = new Memo({
      sender: memo.sender,
      recipient: adminUser._id,
      subject: memo.subject,
      content: memo.content || '',
      htmlContent: memo.htmlContent || '',
      department: memo.department,
      departments: memo.departments,
      recipients: memo.recipients || [],
      priority: memo.priority || 'medium',
      createdBy: memo.createdBy || memo.sender,
      attachments: memo.attachments || [],
      signatures: memo.signatures || [],
      template: memo.template || 'none',
      status: MEMO_STATUS.APPROVED,
      folder: 'sent',
      isRead: false,
      metadata: {
        originalMemoId: memo._id.toString(),
        eventType: 'memo_approved_by_admin',
        approvedBy: adminUser._id.toString(),
        approvedAt: new Date().toISOString()
      }
    });
    await adminMemo.save();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to update original memo after approval:', e?.message || e);
  }

  // Fire-and-forget Google Drive backup of the approved memo
  // Use the delivered memo (createdMemos[0]) instead of the original pending memo
  // This ensures the recipient field shows the actual recipient, not the secretary
  try {
    // deliver() now returns { memo, createdMemos, calendarEvents }
    const createdMemos = deliverResult?.createdMemos || [];

    // If deliver() didn't return createdMemos, query for them
    let recipientMemos = createdMemos;
    if (!recipientMemos || recipientMemos.length === 0) {
      recipientMemos = await Memo.find({
        'metadata.originalMemoId': memo._id.toString(),
        status: { $in: ['sent', 'approved', 'read'] }
      }).limit(1).lean();
    }

    if (recipientMemos && recipientMemos.length > 0) {
      // Use the first recipient memo which has the correct recipient
      const deliveredMemoId = recipientMemos[0]._id;
      Memo.findById(deliveredMemoId)
        .populate('sender', 'firstName lastName email profilePicture department')
        .populate('recipient', 'firstName lastName email profilePicture department')
        .lean()
        .then((populatedMemo) => {
          if (populatedMemo) {
            // Also populate recipients array if it exists
            if (populatedMemo.recipients && Array.isArray(populatedMemo.recipients) && populatedMemo.recipients.length > 0) {
              return User.find({ _id: { $in: populatedMemo.recipients } })
                .select('firstName lastName email profilePicture department')
                .lean()
                .then((recipientUsers) => {
                  populatedMemo.recipients = recipientUsers;
                  populatedMemo.attachments = memo.attachments || [];
                  return googleDriveService.uploadMemoToDrive(populatedMemo);
                });
            } else {
              populatedMemo.attachments = memo.attachments || [];
              return googleDriveService.uploadMemoToDrive(populatedMemo);
            }
          }
          return null;
        })
        .then((driveFileId) => {
          if (driveFileId) {
            // eslint-disable-next-line no-console
            console.log(`✅ Approved memo backed up to Google Drive: ${driveFileId}`);
          }
        })
        .catch((backupError) => {
          // eslint-disable-next-line no-console
          console.error('⚠️ Google Drive backup failed after approval:', backupError?.message || backupError);
        });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Drive backup trigger error (approval):', e?.message || e);
  }
  return memo;
}

async function reject({ memoId, adminUser, reason }) {
  const memo = await Memo.findById(memoId);
  if (!memo) {throw new Error('Memo not found');}

  // Check if memo has already been approved or rejected by another admin
  if (memo.status === 'approved' || memo.status === 'rejected') {
    // Check if this admin already acted on it
    const hasAdminAction = memo.metadata?.history?.some(h =>
      (h.by?._id?.toString() === adminUser._id.toString() ||
       h.by?.toString() === adminUser._id.toString()) &&
      (h.action === 'approved' || h.action === 'rejected')
    );

    if (!hasAdminAction) {
      throw new Error('This memo has already been processed by another admin.');
    }
  }
  // Record rejection and keep the record
  await appendHistory(memo, adminUser, 'rejected', reason);
  await notifySecretary({ memo, actor: adminUser, action: 'rejected', reason });
  await archivePendingAdminNotifications(memoId);

  // Keep the original pending memo; mark as REJECTED
  // Set folder to 'sent' so it appears in admin inbox
  try {
    memo.status = MEMO_STATUS.REJECTED;
    memo.folder = 'sent';
    await memo.save();

    // Create a memo entry for admin so it appears in their inbox
    const adminMemo = new Memo({
      sender: memo.sender,
      recipient: adminUser._id,
      subject: memo.subject,
      content: memo.content || '',
      htmlContent: memo.htmlContent || '',
      department: memo.department,
      departments: memo.departments,
      recipients: memo.recipients || [],
      priority: memo.priority || 'medium',
      createdBy: memo.createdBy || memo.sender,
      attachments: memo.attachments || [],
      signatures: memo.signatures || [],
      template: memo.template || 'none',
      status: MEMO_STATUS.REJECTED,
      folder: 'sent',
      isRead: false,
      metadata: {
        originalMemoId: memo._id.toString(),
        eventType: 'memo_rejected_by_admin',
        rejectedBy: adminUser._id.toString(),
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || ''
      }
    });
    await adminMemo.save();
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
    return { memo, createdMemos: [], calendarEvents: [] };
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
    return { memo, createdMemos: [], calendarEvents: [] };
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
        if (ru.email) {recipientEmails.push(ru.email.toLowerCase());}
        if (ru.department) {recipientDepartments.add(ru.department);}
      });

      // Add departments from memo
      if (memo.departments && Array.isArray(memo.departments)) {
        memo.departments.forEach(dept => {
          if (dept) {recipientDepartments.add(dept);}
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

      // Mark workflow memo as approved (not sent) and persist history
      memo.status = MEMO_STATUS.APPROVED;
      await appendHistory(memo, actor, 'sent');
      await memo.save();
      return { memo, createdMemos, calendarEvents: [calendarEvent] }; // Return created memos and calendar event
    } catch (calendarError) {
      console.error('⚠️ Failed to create calendar event for approved memo:', calendarError.message);
      // Continue to return even if calendar event creation failed
    }
  }

  // Mark workflow memo as approved (not sent) and persist history
  memo.status = MEMO_STATUS.APPROVED;
  await appendHistory(memo, actor, 'sent');
  await memo.save();
  return { memo, createdMemos, calendarEvents: [] }; // Return created memos for Google Drive backup
}

// Enhanced versions with rollback support (NEW - doesn't break existing code)
// These functions use MongoDB transactions for atomic operations

/**
 * Approve memo with transaction rollback support
 * If any step fails, all changes are automatically rolled back
 */
async function approveWithRollback({ memoId, adminUser }) {
  const operationId = `approve_${memoId}_${Date.now()}`;
  let beforeState = {};
  let afterState = {};

  const result = await executeWithRollback(async (session) => {
    // Capture before state
    const originalMemo = await Memo.findById(memoId).session(session).lean();
    if (!originalMemo) {throw new Error('Memo not found');}

    // Check if memo has already been approved or rejected by another admin
    if (originalMemo.status === 'approved' || originalMemo.status === 'rejected') {
      // Check if this admin already acted on it
      const hasAdminAction = originalMemo.metadata?.history?.some(h =>
        (h.by?._id?.toString() === adminUser._id.toString() ||
         h.by?.toString() === adminUser._id.toString()) &&
        (h.action === 'approved' || h.action === 'rejected')
      );

      if (!hasAdminAction) {
        throw new Error('This memo has already been processed by another admin.');
      }
    }

    beforeState = {
      originalMemo: {
        _id: originalMemo._id,
        status: originalMemo.status,
        folder: originalMemo.folder
      }
    };

    // Perform approval operations within transaction
    const memo = await Memo.findById(memoId).session(session);
    await appendHistory(memo, adminUser, 'approved');

    // Update memo status - keep it visible in admin inbox
    memo.status = MEMO_STATUS.APPROVED;
    memo.folder = 'sent'; // Change to 'sent' so it appears in admin inbox
    await memo.save({ session });

    // Create a memo entry for admin so it appears in their inbox
    // This shows admin what they approved/rejected
    const adminMemo = new Memo({
      sender: memo.sender, // Original sender (secretary)
      recipient: adminUser._id, // Admin who approved it
      subject: memo.subject,
      content: memo.content || '',
      htmlContent: memo.htmlContent || '',
      department: memo.department,
      departments: memo.departments,
      recipients: memo.recipients || [],
      priority: memo.priority || 'medium',
      createdBy: memo.createdBy || memo.sender,
      attachments: memo.attachments || [],
      signatures: memo.signatures || [],
      template: memo.template || 'none',
      status: MEMO_STATUS.APPROVED,
      folder: 'sent',
      isRead: false,
      metadata: {
        originalMemoId: memo._id.toString(),
        eventType: 'memo_approved_by_admin',
        approvedBy: adminUser._id.toString(),
        approvedAt: new Date().toISOString()
      }
    });
    await adminMemo.save({ session });

    // Deliver memo (creates recipient memos)
    const deliveryResult = await deliverWithRollback({ memo, actor: adminUser, session });

    // Archive notifications (within transaction)
    await archivePendingAdminNotifications(memoId, session);

    // Capture after state for rollback metadata
    afterState = {
      originalMemo: {
        _id: memo._id,
        status: memo.status,
        folder: memo.folder
      },
      recipientMemos: deliveryResult.createdMemos || [],
      calendarEvents: deliveryResult.calendarEvents || []
    };

    // Store rollback metadata (non-blocking)
    storeRollbackMetadata(operationId, 'memo_approval', beforeState, afterState, adminUser._id)
      .catch(err => console.error('Failed to store rollback metadata:', err));

    // Notify secretary (outside transaction - notifications are fire-and-forget)
    notifySecretary({ memo, actor: adminUser, action: 'approved' })
      .catch(err => console.error('Notification failed:', err));

    // Google Drive backup (fire-and-forget, outside transaction)
    // Use the delivered memo (createdMemos[0]) instead of the original pending memo
    // This ensures the recipient field shows the actual recipient, not the secretary
    if (deliveryResult && deliveryResult.createdMemos && deliveryResult.createdMemos.length > 0) {
      // Use the first delivered memo which has the correct recipient
      const deliveredMemoId = deliveryResult.createdMemos[0]._id;
      Memo.findById(deliveredMemoId)
        .populate('sender', 'firstName lastName email profilePicture department')
        .populate('recipient', 'firstName lastName email profilePicture department')
        .lean()
        .then((populatedMemo) => {
          if (populatedMemo) {
            // Also populate recipients array if it exists
            if (populatedMemo.recipients && Array.isArray(populatedMemo.recipients) && populatedMemo.recipients.length > 0) {
              return User.find({ _id: { $in: populatedMemo.recipients } })
                .select('firstName lastName email profilePicture department')
                .lean()
                .then((recipientUsers) => {
                  populatedMemo.recipients = recipientUsers;
                  populatedMemo.attachments = memo.attachments || [];
                  return googleDriveService.uploadMemoToDrive(populatedMemo);
                });
            } else {
              populatedMemo.attachments = memo.attachments || [];
              return googleDriveService.uploadMemoToDrive(populatedMemo);
            }
          }
          return null;
        })
        .then((driveFileId) => {
          if (driveFileId) {
            console.log(`✅ Approved memo backed up to Google Drive: ${driveFileId}`);
          }
        })
        .catch((backupError) => {
          console.error('⚠️ Google Drive backup failed after approval:', backupError?.message || backupError);
        });
    }

    return memo;
  });

  if (!result.success) {
    throw new Error(`Approval failed: ${result.error}`);
  }

  return result.result;
}

/**
 * Deliver memo with transaction support
 * Internal helper function used by approveWithRollback
 */
async function deliverWithRollback({ memo, actor, session }) {
  const CalendarEvent = require('../models/CalendarEvent');

  // Determine recipients (same logic as original deliver function)
  let recipientIds = Array.isArray(memo.recipients) ? memo.recipients.slice() : [];
  if (!recipientIds || recipientIds.length === 0) {
    const deptList = Array.isArray(memo.departments) && memo.departments.length
      ? memo.departments
      : (memo.department ? [memo.department] : []);
    if (deptList.length > 0) {
      const faculty = await User.find({ role: 'faculty', department: { $in: deptList }, isActive: true })
        .select('_id')
        .session(session);
      recipientIds = faculty.map(u => u._id);
    }
  }

  const senderIdStr = String(memo.sender || (actor && actor._id) || '');
  const finalRecipients = (recipientIds || []).filter(r => String(r) !== senderIdStr);

  const recipientUsers = await User.find({ _id: { $in: finalRecipients } })
    .select('_id role')
    .session(session);
  const facultyRecipients = recipientUsers
    .filter(u => u.role === 'faculty')
    .map(u => u._id);

  const uniqueRecipients = [...new Set(facultyRecipients.map(r => String(r)))];

  if (uniqueRecipients.length === 0) {
    console.warn('No faculty recipients found for memo delivery');
    return { createdMemos: [], calendarEvents: [] };
  }

  const originalMemoId = memo._id.toString();
  const existingMemos = await Memo.find({
    'metadata.originalMemoId': originalMemoId,
    recipient: { $in: uniqueRecipients },
    status: { $in: ['sent', 'approved', 'read'] }
  })
    .select('recipient')
    .session(session)
    .lean();

  const existingRecipientIds = new Set(
    existingMemos.map(m => String(m.recipient))
  );

  const recipientsToCreate = uniqueRecipients.filter(
    r => !existingRecipientIds.has(String(r))
  );

  if (recipientsToCreate.length === 0) {
    console.log(`All recipients already have memos for originalMemoId: ${originalMemoId}`);
    return { createdMemos: [], calendarEvents: [] };
  }

  // Create recipient memos within transaction
  const createOps = recipientsToCreate.map(r => new Memo({
    sender: memo.sender,
    recipient: r,
    subject: memo.subject,
    content: memo.content || '',
    htmlContent: memo.htmlContent || '',
    department: memo.department,
    departments: memo.departments,
    recipients: uniqueRecipients,
    priority: memo.priority || 'medium',
    createdBy: memo.createdBy || memo.sender,
    attachments: memo.attachments || [],
    signatures: memo.signatures || [],
    template: memo.template || 'none',
    status: MEMO_STATUS.SENT,
    folder: MEMO_STATUS.SENT,
    isRead: false,
    metadata: {
      originalMemoId: originalMemoId,
      eventType: 'memo_delivered',
      approvedAt: new Date().toISOString(),
      approvedBy: actor?._id?.toString() || String(actor?._id || '')
    }
  }));

  const createdMemos = [];
  for (const memoDoc of createOps) {
    await memoDoc.save({ session });
    createdMemos.push(memoDoc);
  }

  console.log(`✅ Notified ${createdMemos.length} recipients about approved memo: ${memo.subject}`);

  // Create calendar event if needed (within transaction)
  const calendarEvents = [];
  if (memo.metadata && memo.metadata.eventDate && createdMemos.length > 0) {
    try {
      const { eventDate, eventTime, allDay } = memo.metadata;
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

      const recipientEmails = [];
      const recipientDepartments = new Set();
      const recipientUsers = await User.find({ _id: { $in: finalRecipients } })
        .select('email department')
        .session(session)
        .lean();
      recipientUsers.forEach(ru => {
        if (ru.email) {recipientEmails.push(ru.email.toLowerCase());}
        if (ru.department) {recipientDepartments.add(ru.department);}
      });

      if (memo.departments && Array.isArray(memo.departments)) {
        memo.departments.forEach(dept => {
          if (dept) {recipientDepartments.add(dept);}
        });
      }

      const categoryMap = {
        'urgent': 'urgent',
        'high': 'high',
        'medium': 'standard',
        'low': 'low'
      };
      const category = categoryMap[memo.priority] || 'standard';

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

      await calendarEvent.save({ session });
      calendarEvents.push(calendarEvent);

      await Memo.findByIdAndUpdate(createdMemos[0]._id, {
        'metadata.calendarEventId': calendarEvent._id,
        'metadata.hasCalendarEvent': true
      }, { session });

      console.log(`✅ Calendar event created for approved memo: ${memo.subject} (Event ID: ${calendarEvent._id})`);
    } catch (calendarError) {
      console.error('⚠️ Failed to create calendar event for approved memo:', calendarError.message);
      throw calendarError; // Re-throw to trigger rollback
    }
  }

  // Update memo history
  await appendHistory(memo, actor, 'sent');
  memo.status = MEMO_STATUS.APPROVED;
  await memo.save({ session });

  return { createdMemos, calendarEvents };
}

/**
 * Reject memo with transaction rollback support
 */
async function rejectWithRollback({ memoId, adminUser, reason }) {
  const operationId = `reject_${memoId}_${Date.now()}`;
  let beforeState = {};
  let afterState = {};

  const result = await executeWithRollback(async (session) => {
    const memo = await Memo.findById(memoId).session(session);
    if (!memo) {throw new Error('Memo not found');}

    // Check if memo has already been approved or rejected by another admin
    if (memo.status === 'approved' || memo.status === 'rejected') {
      // Check if this admin already acted on it
      const hasAdminAction = memo.metadata?.history?.some(h =>
        (h.by?._id?.toString() === adminUser._id.toString() ||
         h.by?.toString() === adminUser._id.toString()) &&
        (h.action === 'approved' || h.action === 'rejected')
      );

      if (!hasAdminAction) {
        throw new Error('This memo has already been processed by another admin.');
      }
    }

    // Capture before state
    beforeState = {
      memo: {
        _id: memo._id,
        status: memo.status,
        folder: memo.folder
      }
    };

    // Perform rejection - keep it visible in admin inbox
    await appendHistory(memo, adminUser, 'rejected', reason);
    memo.status = MEMO_STATUS.REJECTED;
    memo.folder = 'sent'; // Change to 'sent' so it appears in admin inbox
    await memo.save({ session });

    // Create a memo entry for admin so it appears in their inbox
    // This shows admin what they approved/rejected
    const adminMemo = new Memo({
      sender: memo.sender, // Original sender (secretary)
      recipient: adminUser._id, // Admin who rejected it
      subject: memo.subject,
      content: memo.content || '',
      htmlContent: memo.htmlContent || '',
      department: memo.department,
      departments: memo.departments,
      recipients: memo.recipients || [],
      priority: memo.priority || 'medium',
      createdBy: memo.createdBy || memo.sender,
      attachments: memo.attachments || [],
      signatures: memo.signatures || [],
      template: memo.template || 'none',
      status: MEMO_STATUS.REJECTED,
      folder: 'sent',
      isRead: false,
      metadata: {
        originalMemoId: memo._id.toString(),
        eventType: 'memo_rejected_by_admin',
        rejectedBy: adminUser._id.toString(),
        rejectedAt: new Date().toISOString(),
        rejectionReason: reason || ''
      }
    });
    await adminMemo.save({ session });

    await archivePendingAdminNotifications(memoId, session);

    // Capture after state
    afterState = {
      memo: {
        _id: memo._id,
        status: memo.status,
        folder: memo.folder
      }
    };

    // Store rollback metadata
    storeRollbackMetadata(operationId, 'memo_rejection', beforeState, afterState, adminUser._id)
      .catch(err => console.error('Failed to store rollback metadata:', err));

    // Notify secretary (outside transaction)
    notifySecretary({ memo, actor: adminUser, action: 'rejected', reason })
      .catch(err => console.error('Notification failed:', err));

    return memo;
  });

  if (!result.success) {
    throw new Error(`Rejection failed: ${result.error}`);
  }

  return result.result;
}

module.exports = {
  createBySecretary,
  approve,
  reject,
  deliver,
  appendHistory,
  // New rollback-enabled functions (optional to use)
  approveWithRollback,
  rejectWithRollback
};


