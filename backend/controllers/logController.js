const Memo = require('../models/Memo');
const User = require('../models/User');

// Get all memos for a user
exports.getAllMemos = async (req, res) => {
    try {
        const userId = req.user._id;
        const { folder = 'inbox' } = req.query;

        let query = {};

        if (folder === 'inbox') {
            // For admins, show both system activity logs AND received memos
            const user = await User.findById(userId);
            if (user.role === 'admin') {
                // Admin inbox: show received memos (not just activity logs)
                // Users receive memos sent TO them, regardless of activityType
                query = {
                    recipient: userId,
                    status: { $ne: 'deleted' }
                    // Include both regular memos and activity logs
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

// Basic HTML sanitization function
function sanitizeHTML(html) {
    if (!html) return '';
    // Remove script tags and dangerous event handlers
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/<iframe/gi, '&lt;iframe');
}

// Create a new memo
exports.createMemo = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        const { recipientEmail, subject, content, departments, priority } = req.body;

        // Validation: At least one recipient or department required
        // Handle multiple recipient emails (comma-separated)
        const recipientEmailValues = recipientEmail
            ? recipientEmail.split(',').map(e => e.trim()).filter(e => e)
            : [];
        const departmentsArray = Array.isArray(departments) ? departments.filter(d => d) :
                               (departments ? [departments] : []);

        if (recipientEmailValues.length === 0 && departmentsArray.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please specify at least one recipient or department.'
            });
        }

        if (!subject || !subject.trim()) {
            return res.status(400).json({ success: false, message: 'Subject is required.' });
        }

        // Content is optional (can be empty)
        const textContent = content ? content.trim() : '';

        // Role-based permission check
        if (user.role === 'secretary' && !user.canCrossSend) {
            // Secretary can only send to their own department
            const userDept = user.department;
            const invalidDepartments = departmentsArray.filter(dept => dept !== userDept);
            if (invalidDepartments.length > 0) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to send memos to other departments.'
                });
            }
        }

        // Handle attachments - process files from req.files (multer)
        const processedAttachments = [];
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                if (file.mimetype.startsWith('image/')) {
                    // Convert image to PDF
                    try {
                        // Generate PDF filename: replace extension with .pdf
                        const pdfFilename = file.filename.replace(/\.[^/.]+$/, '.pdf');
                        const pdfPath = path.join(path.dirname(file.path), pdfFilename);
                        const doc = new PDFDocument({ margin: 50 });
                        const stream = fs.createWriteStream(pdfPath);

                        doc.pipe(stream);
                        doc.image(file.path, {
                            fit: [500, 700],
                            align: 'center',
                            valign: 'center'
                        });
                        doc.end();

                        await new Promise((resolve, reject) => {
                            stream.on('finish', resolve);
                            stream.on('error', reject);
                        });

                        // Delete original image file
                        try {
                            fs.unlinkSync(file.path);
                        } catch (unlinkError) {
                            console.error('Error deleting original image:', unlinkError);
                        }

                        processedAttachments.push({
                            filename: pdfFilename,
                            path: pdfPath,
                            url: `/uploads/${pdfFilename}`,
                            size: fs.statSync(pdfPath).size,
                            mimetype: 'application/pdf'
                        });
                    } catch (error) {
                        console.error('Error converting image to PDF:', error);
                        // Fallback: keep original image if PDF conversion fails
                        processedAttachments.push({
                            filename: file.originalname,
                            path: file.path,
                            url: `/uploads/${file.filename}`,
                            size: file.size,
                            mimetype: file.mimetype
                        });
                    }
                } else {
                    // Non-image files: keep as-is
                    processedAttachments.push({
                        filename: file.originalname,
                        path: file.path,
                        url: `/uploads/${file.filename}`,
                        size: file.size,
                        mimetype: file.mimetype
                    });
                }
            }
        }

        // Determine recipients
        const recipientIds = [];
        if (recipientEmailValues.length > 0) {
            for (const email of recipientEmailValues) {
                const recipient = await User.findOne({ email: email.toLowerCase() });
                if (recipient) {
                    if (!recipientIds.find(id => id.toString() === recipient._id.toString())) {
                        recipientIds.push(recipient._id);
                    }
                }
            }
        }

        // Get all users from selected departments
        if (departmentsArray.length > 0) {
            const departmentUsers = await User.find({
                department: { $in: departmentsArray },
                role: { $ne: 'admin' } // Don't send to admins unless explicitly specified
            }).select('_id');
            departmentUsers.forEach(user => {
                if (!recipientIds.find(id => id.toString() === user._id.toString())) {
                    recipientIds.push(user._id);
                }
            });
        }

        if (recipientIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid recipients found.'
            });
        }

        const isSecretary = (user.role === 'secretary');

        // Create memos for all recipients
        const memoPromises = recipientIds.map(async (recipientId) => {
            const memo = new Memo({
                sender: userId,
                recipient: recipientId,
                subject: subject.trim(),
                content: textContent,
                department: departmentsArray[0] || user.department, // Primary department
                departments: departmentsArray,
                recipients: recipientIds,
                priority: priority || 'medium',
                createdBy: userId,
                attachments: processedAttachments,
                status: isSecretary ? 'pending' : 'sent',
                folder: isSecretary ? 'drafts' : 'sent'
            });
            return await memo.save();
        });

        const createdMemos = await Promise.all(memoPromises);

        if (isSecretary) {
            // Notify admins of pending memo
            try {
                const { createSystemLog } = require('../services/logService');
                await createSystemLog({
                    activityType: 'pending_memo',
                    user: {
                        _id: userId,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        department: user.department
                    },
                    subject: `Memo Pending Approval: ${subject}`,
                    content: `A memo from ${user.email} is awaiting approval. Subject: ${subject}`,
                    department: departmentsArray[0] || user.department
                });
            } catch (e) {
                console.error('Failed to create pending memo log:', e.message);
            }
        }

        // Fetch first memo with attachments included for response
        const populatedMemo = await Memo.findById(createdMemos[0]._id)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department')
            .lean();

        populatedMemo.attachments = createdMemos[0].attachments;

        res.status(201).json({
            success: true,
            memo: populatedMemo,
            count: createdMemos.length,
            message: isSecretary
                ? `Your memo is pending for admin approval. It will be sent to ${createdMemos.length} recipient(s) once approved.`
                : `Memo sent successfully to ${createdMemos.length} recipient(s).`
        });
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
}

// Upload file for inline embedding
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Validate file size
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (req.file.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                success: false,
                message: `File ${req.file.originalname} exceeds 10MB limit.`
            });
        }

        // Return file URL
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Error uploading file' });
    }
};

// Upload image for inline embedding
exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }

        // Validate file size
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (req.file.size > MAX_FILE_SIZE) {
            return res.status(400).json({
                success: false,
                message: `Image ${req.file.originalname} exceeds 10MB limit.`
            });
        }

        // Validate image type
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({
                success: false,
                message: 'File is not a valid image'
            });
        }

        // Return image URL
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error uploading image:', error);
        res.status(500).json({ success: false, message: 'Error uploading image' });
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

