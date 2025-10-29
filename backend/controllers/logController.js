const Memo = require('../models/Memo');
const User = require('../models/User');

// Get all memos for a user
exports.getAllMemos = async (req, res) => {
    try {
        const userId = req.user._id;
        const { folder = 'inbox' } = req.query;

        let query = {};

        if (folder === 'inbox') {
            // For admins, show all system logs (activity logs)
            const user = await User.findById(userId);
            if (user.role === 'admin') {
                // Admin inbox: show all activity logs (system logs to admin)
                query = {
                    recipient: userId,
                    status: { $ne: 'deleted' },
                    activityType: { $ne: null } // Only system activity logs
                };
            } else {
                // Regular users: only their received memos
                query = { recipient: userId, status: { $ne: 'deleted' } };
            }
        } else if (folder === 'sent') {
            query = { sender: userId, folder: 'sent', status: { $ne: 'deleted' } };
        } else if (folder === 'starred') {
            query = {
                $or: [
                    { sender: userId },
                    { recipient: userId }
                ],
                isStarred: true,
                status: { $ne: 'deleted' }
            };
        } else if (folder === 'activity') {
            // Activity Logs folder: show all system activity logs
            query = {
                recipient: userId,
                activityType: { $ne: null } // Show all system activity logs
            };
        } else if (folder === 'deleted') {
            // For deleted folder, show only memos that were manually deleted from Inbox/Sent
            query = {
                $or: [
                    { sender: userId },
                    { recipient: userId }
                ],
                status: 'deleted' // Only show manually deleted items
            };
        }

        const memos = await Memo.find(query)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department')
            .sort({ createdAt: -1 });

        res.json({ success: true, memos });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching memos:', error);
        res.status(500).json({ success: false, message: 'Error fetching memos' });
    }
};

// Get a single memo
exports.getMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const memo = await Memo.findById(id)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department');

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        // Check if user has access to this memo
        if (memo.sender?._id?.toString() !== userId.toString() &&
            memo.recipient?._id?.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Mark as read if recipient
        if (memo.recipient?._id && memo.recipient._id.toString() === userId.toString() && !memo.isRead) {
            memo.isRead = true;
            memo.readAt = new Date();
            await memo.save();
        }

        res.json({ success: true, memo });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching memo:', error);
        res.status(500).json({ success: false, message: 'Error fetching memo' });
    }
};

// Create a new memo
exports.createMemo = async (req, res) => {
    try {
        const userId = req.user._id;
        const { recipientEmail, subject, content, department, priority } = req.body;

        // eslint-disable-next-line no-console
        console.log('=== MEMO CREATE DEBUG ===');
        // eslint-disable-next-line no-console
        console.log('Request body:', { recipientEmail, subject, content, department, priority });
        // eslint-disable-next-line no-console
        console.log('req.files exists?', !!req.files);
        // eslint-disable-next-line no-console
        console.log('req.files type:', typeof req.files);
        // eslint-disable-next-line no-console
        console.log('req.files length:', req.files ? req.files.length : 0);
        // eslint-disable-next-line no-console
        console.log('req.files:', req.files);
        // eslint-disable-next-line no-console
        console.log('req.file (single):', req.file);
        // eslint-disable-next-line no-console
        console.log('========================');

        // Find recipient by email
        const recipient = await User.findOne({ email: recipientEmail });
        if (!recipient) {
            return res.status(404).json({ success: false, message: 'Recipient not found' });
        }

        // Handle file uploads
        const attachments = [];
        if (req.files && req.files.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`Processing ${req.files.length} uploaded file(s)...`);
            req.files.forEach((file, index) => {
                const attachment = {
                    filename: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype
                };
                // eslint-disable-next-line no-console
                console.log(`Attachment ${index + 1}:`, attachment);
                attachments.push(attachment);
            });
        } else {
            // eslint-disable-next-line no-console
            console.log('No files detected in req.files');
        }

        // eslint-disable-next-line no-console
        console.log(`Total attachments to save: ${attachments.length}`);

        const isSecretary = (req.user?.role === 'secretary');
        const memo = new Memo({
            sender: userId,
            recipient: recipient._id,
            subject,
            content,
            department,
            priority,
            createdBy: userId,
            role: isSecretary ? 'secretary' : 'admin',
            attachments: attachments,
            status: isSecretary ? 'pending' : 'sent',
            folder: isSecretary ? 'drafts' : 'sent'
        });

        // eslint-disable-next-line no-console
        console.log('Memo before save:', {
            subject: memo.subject,
            attachmentsCount: memo.attachments.length,
            attachments: memo.attachments
        });

        await memo.save();

        // eslint-disable-next-line no-console
        console.log('Memo after save - ID:', memo._id);
        // eslint-disable-next-line no-console
        console.log('Saved attachments:', memo.attachments);

        if (isSecretary) {
            // Notify admins of pending memo
            try {
                const { createSystemLog } = require('../services/logService');
                await createSystemLog({
                    activityType: 'pending_memo',
                    user: { _id: userId, email: req.user.email, firstName: req.user.firstName, lastName: req.user.lastName, department: req.user.department },
                    subject: `Memo Pending Approval: ${subject}`,
                    content: `A memo from ${req.user.email} is awaiting approval. Subject: ${subject}`,
                    department
                });
            } catch (e) {
                console.error('Failed to create pending memo log:', e.message);
            }
        }

        // Fetch with attachments included
        const populatedMemo = await Memo.findById(memo._id)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department')
            .lean();

        // Explicitly add attachments to populatedMemo
        populatedMemo.attachments = memo.attachments;

        // If admin sent the memo, create a recipient notification
        if (!isSecretary) {
            try {
                await Memo.create({
                    sender: userId,
                    recipient: recipient._id,
                    subject: `New Memo: ${subject}`,
                    content: `You received a memo from ${req.user.email}.`,
                    department,
                    priority: 'medium',
                    status: 'sent',
                    folder: 'sent',
                    activityType: 'memo_received'
                });
            } catch (e) {
                console.error('Failed to create recipient notification:', e.message);
            }
        }

        res.status(201).json({ success: true, memo: populatedMemo, message: isSecretary ? 'Your memo is pending for admin approval.' : 'Memo sent successfully.' });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error creating memo:', error);
        res.status(500).json({ success: false, message: 'Error creating memo' });
    }
};

// Update memo (star/unstar, move to folder, etc.)
exports.updateMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const { isStarred, folder, status } = req.body;

        const memo = await Memo.findById(id);

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        // Check if user has access
        if (memo.sender?._id?.toString() !== userId.toString() &&
            memo.recipient?._id?.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (isStarred !== undefined) {memo.isStarred = isStarred;}
        if (folder) {memo.folder = folder;}
        if (status) {memo.status = status;}

        await memo.save();

        const populatedMemo = await Memo.findById(memo._id)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department');

        res.json({ success: true, memo: populatedMemo });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error updating memo:', error);
        res.status(500).json({ success: false, message: 'Error updating memo' });
    }
};

// Delete memo (move to deleted folder)
exports.deleteMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const memo = await Memo.findById(id);

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        // Check if user has access
        if (memo.sender?._id?.toString() !== userId.toString() &&
            memo.recipient?._id?.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        memo.status = 'deleted';
        memo.folder = 'deleted';
        await memo.save();

        res.json({ success: true, message: 'Memo deleted successfully' });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error deleting memo:', error);
        res.status(500).json({ success: false, message: 'Error deleting memo' });
    }
};

// Restore a deleted memo
exports.restoreMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const memo = await Memo.findById(id);

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        // Check if user has access
        if (memo.sender?._id?.toString() !== userId.toString() &&
            memo.recipient?._id?.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Restore the memo
        memo.status = 'sent';
        await memo.save();

        res.json({ success: true, message: 'Memo restored successfully' });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error restoring memo:', error);
        res.status(500).json({ success: false, message: 'Error restoring memo' });
    }
};

// Permanently delete memo
exports.permanentDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const memo = await Memo.findById(id);

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        // Check if user has access
        if (memo.sender?._id?.toString() !== userId.toString() &&
            memo.recipient?._id?.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await Memo.findByIdAndDelete(id);

        res.json({ success: true, message: 'Memo permanently deleted' });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error permanently deleting memo:', error);
        res.status(500).json({ success: false, message: 'Error deleting memo' });
    }
};

// Department users (for secretary search)
exports.getDepartmentUsers = async (req, res) => {
    try {
        const department = req.user.department;
        if (!department) {
            return res.json({ success: true, users: [] });
        }
        const User = require('../models/User');
        const users = await User.find({ department, role: { $ne: 'admin' } })
            .select('_id email firstName lastName role department')
            .sort({ firstName: 1, lastName: 1 });
        res.json({ success: true, users });
    } catch (e) {
        console.error('Error fetching department users:', e);
        res.status(500).json({ success: false, message: 'Error fetching department users' });
    }
};

// Distribute memo to multiple recipients within department (secretary)
exports.distributeMemo = async (req, res) => {
    try {
        const { subject, message, recipients } = req.body || {};
        if (!subject || !message || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ success: false, message: 'Subject, message, and recipients are required' });
        }
        const department = req.user.department;
        const User = require('../models/User');

        // Validate recipients belong to same department
        const users = await User.find({ _id: { $in: recipients } }).select('_id department email');
        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'No valid recipients found in your department' });
        }
        const normalizeDept = (d) => String(d || '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/\s+/g, '')
            .replace(/[-_]/g, '')
            .replace(/department$/g, '')
            .replace(/itandemc|itemc/g, 'itemc') // unify it/emc variants
            .replace(/\//g, '');
        const target = normalizeDept(department);
        const invalid = users.some(u => normalizeDept(u.department) !== target);
        if (invalid) {
            return res.status(403).json({ success: false, message: 'Recipients must belong to your department' });
        }

        // Create pending memos per recipient
        const createOps = users.map(u => ({
            sender: req.user._id,
            recipient: u._id,
            subject,
            content: message,
            department,
            priority: 'medium',
            createdBy: req.user._id,
            role: 'secretary',
            status: 'pending',
            folder: 'drafts'
        }));

        let inserted;
        try {
            inserted = await require('../models/Memo').insertMany(createOps);
        } catch (e) {
            console.error('insertMany error (distributeMemo):', e);
            return res.status(500).json({ success: false, message: 'Failed to save memos', detail: e.message });
        }

        // Notify admins about pending memo(s)
        try {
            const { createSystemLog } = require('../services/logService');
            await createSystemLog({
                activityType: 'pending_memo',
                user: req.user,
                subject: `Memo Pending Approval: ${subject}`,
                content: `A memo from ${req.user.email} to ${users.length} recipient(s) is awaiting approval.`,
                department
            });
        } catch (e) {
            console.error('Failed to create pending memo log:', e.message);
        }

        res.json({ success: true, count: inserted.length, message: 'Memo submitted successfully and is pending admin approval.' });
        } catch (error) {
        console.error('Error distributing memo:', error);
        res.status(500).json({ success: false, message: 'Error distributing memo', detail: error.message });
    }
};
// Admin: approve a pending memo
exports.approveMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const memo = await Memo.findById(id);
        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }
        memo.status = 'sent'; // treat approved as sent
        memo.folder = 'sent';
        await memo.save();

        // Notify secretary (creator)
        try {
            const { createSystemLog } = require('../services/logService');
            const creator = await require('../models/User').findById(memo.createdBy).select('email firstName lastName department');
            await createSystemLog({
                activityType: 'memo_approved',
                user: creator || { _id: memo.createdBy },
                subject: `Memo Approved: ${memo.subject}`,
                content: 'Your memo has been approved by admin and sent to recipients.',
                department: memo.department
            });
        } catch (e) {
            console.error('Failed to log approval notification:', e.message);
        }

        res.json({ success: true, message: 'Memo approved and sent.' });
    } catch (error) {
        console.error('Error approving memo:', error);
        res.status(500).json({ success: false, message: 'Error approving memo' });
    }
};

// Admin: reject a pending memo
exports.rejectMemo = async (req, res) => {
    try {
        const { id } = req.params;
        const memo = await Memo.findById(id);
        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }
        memo.status = 'rejected';
        memo.folder = 'deleted';
        await memo.save();

        // Notify secretary (creator)
        try {
            const { createSystemLog } = require('../services/logService');
            const creator = await require('../models/User').findById(memo.createdBy).select('email firstName lastName department');
            await createSystemLog({
                activityType: 'memo_rejected',
                user: creator || { _id: memo.createdBy },
                subject: `Memo Rejected: ${memo.subject}`,
                content: 'Your memo has been rejected or removed by the admin.',
                department: memo.department
            });
        } catch (e) {
            console.error('Failed to log rejection notification:', e.message);
        }

        res.json({ success: true, message: 'Memo rejected.' });
    } catch (error) {
        console.error('Error rejecting memo:', error);
        res.status(500).json({ success: false, message: 'Error rejecting memo' });
    }
};

