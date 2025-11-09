const Memo = require('../models/Memo');
const mongoose = require('mongoose');
const User = require('../models/User');
const googleDriveService = require('../services/googleDriveService');
const { approve, reject, createBySecretary } = require('../services/memoWorkflowService');

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
                    status: { $nin: ['deleted','archived'] }
                };
            } else {
                // Regular users: only delivered memos (hide pending workflow items)
                // Status filter already excludes pending, so secretaries won't see their own pending memos
                query = { recipient: userId, status: { $in: ['sent','approved'] } };
            }
        } else if (folder === 'sent') {
            // For sent folder, show memos sent by user
            // Include pending memos for secretaries so they can see what they submitted
            const user = await User.findById(userId);
            if (user.role === 'secretary') {
                query = { sender: userId, status: { $nin: ['deleted','archived'] } };
            } else {
                query = { sender: userId, folder: 'sent', status: { $nin: ['deleted','archived'] } };
            }
        } else if (folder === 'starred') {
            query = {
                $or: [
                    { sender: userId },
                    { recipient: userId }
                ],
                isStarred: true,
                status: { $nin: ['deleted','archived'] }
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
            .populate('sender', 'firstName lastName email profilePicture department role')
            .populate('recipient', 'firstName lastName email profilePicture department role')
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
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid memo id' });
        }
        const userId = req.user._id;

        const memo = await Memo.findById(id)
            .populate('sender', 'firstName lastName email profilePicture department role')
            .populate('recipient', 'firstName lastName email profilePicture department role');

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        // Check if user has access to this memo
        // Admins can view pending memos awaiting their approval
        const isAdmin = req.user.role === 'admin';
        // MEMO_STATUS.PENDING_ADMIN = 'pending' (see memoStatus.js)
        const isPendingAdmin = memo.status === 'pending' || memo.status === 'PENDING_ADMIN' || memo.status === 'pending_admin';
        const isSender = memo.sender?._id?.toString() === userId.toString();
        const isRecipient = memo.recipient?._id?.toString() === userId.toString();

        if (!isSender && !isRecipient && !(isAdmin && isPendingAdmin)) {
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
    if (!html) {return '';}
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
        const { recipientEmail, subject, content, departments, priority, template } = req.body;

        // Handle signatories - FormData sends arrays as multiple fields with same name
        let signatories = req.body.signatories;
        if (!Array.isArray(signatories)) {
            // If it's a string (single value) or not an array, convert to array
            if (signatories) {
                signatories = [signatories];
            } else {
                signatories = [];
            }
        }

        // Extract and process signatures
        const Signature = require('../models/Signature');
        let processedSignatures = [];
        const templateValue = template || 'none';

        if (templateValue && templateValue !== 'none') {
            try {
                // Template can be comma-separated signature IDs
                const signatureIds = templateValue.split(',').filter(id => id && id !== 'none');
                if (signatureIds.length > 0) {
                    const dbSignatures = await Signature.find({ _id: { $in: signatureIds }, isActive: true }).lean();
                    processedSignatures = dbSignatures.map(sig => ({
                        signatureId: sig._id,
                        role: sig.roleTitle || '',
                        displayName: sig.displayName || sig.roleTitle || '',
                        roleTitle: sig.roleTitle || '',
                        imageUrl: sig.imageUrl || ''
                    }));
                }
            } catch (e) {
                console.error('Error loading signatures from template:', e);
            }
        }

        // Also check signatories array (from form submission) - use as fallback
        if (signatories && signatories.length > 0) {
            try {
                const sigIds = signatories
                    .map(s => {
                        try {
                            return typeof s === 'string' ? JSON.parse(s) : s;
                        } catch {
                            return s;
                        }
                    })
                    .map(s => s.signatureId)
                    .filter(Boolean);

                if (sigIds.length > 0) {
                    const dbSignatures = await Signature.find({ _id: { $in: sigIds }, isActive: true }).lean();
                    // Merge with template signatures, avoiding duplicates
                    const existingIds = processedSignatures.map(s => s.signatureId.toString());
                    dbSignatures.forEach(sig => {
                        if (!existingIds.includes(sig._id.toString())) {
                            processedSignatures.push({
                                signatureId: sig._id,
                                role: sig.roleTitle || '',
                                displayName: sig.displayName || sig.roleTitle || '',
                                roleTitle: sig.roleTitle || '',
                                imageUrl: sig.imageUrl || ''
                            });
                        }
                    });
                }
            } catch (e) {
                console.error('Error processing signatories:', e);
            }
        }

        // Validation: At least one recipient or department required
        // Handle multiple recipient emails (comma-separated)
        const recipientEmailValues = recipientEmail
            ? recipientEmail.split(',').map(e => e.trim()).filter(e => e)
            : [];
        let departmentsArray = Array.isArray(departments) ? departments.filter(d => d) :
                               (departments ? [departments] : []);

        // Default to secretary's department if none specified AND no specific recipients selected
        const isSecretary = user && user.role === 'secretary';
        if (isSecretary && recipientEmailValues.length === 0 && (!departmentsArray || departmentsArray.length === 0) && user.department) {
            departmentsArray = [user.department];
        }

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
                    // Keep images as images (don't convert to PDF)
                    // This allows images to be embedded directly in memo PDFs for Google Drive backup
                    // Images can be viewed directly in the app without needing to download
                    processedAttachments.push({
                        filename: file.originalname || file.filename,
                        path: file.path,
                        url: `/uploads/${file.filename}`,
                        size: file.size,
                        mimetype: file.mimetype
                    });
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

        let createdMemos = [];
        if (isSecretary) {
            // Use workflow: a single pending memo owned by secretary, not delivered to recipients yet
            try {
                const workflowMemo = await createBySecretary({
                    user,
                    payload: {
                        recipientEmail: recipientEmailValues.join(','),
                        subject: subject.trim(),
                        content: textContent,
                        departments: departmentsArray,
                        priority: priority || 'medium',
                        attachments: processedAttachments,
                        recipients: recipientIds,
                        signatures: processedSignatures,
                        template: templateValue
                    }
                });
                createdMemos = [workflowMemo];
            } catch (e) {
                console.error('Error creating pending memo via workflow:', e);
                return res.status(500).json({ success: false, message: 'Error creating pending memo' });
            }
        } else {
            // Non-secretaries send immediately
            const memoPromises = recipientIds.map(async (recipientId) => {
                const memo = new Memo({
                    sender: userId,
                    recipient: recipientId,
                    subject: subject.trim(),
                    content: textContent,
                    department: departmentsArray[0] || user.department,
                    departments: departmentsArray,
                    recipients: recipientIds,
                    priority: priority || 'medium',
                    createdBy: userId,
                    attachments: processedAttachments,
                    signatures: processedSignatures,
                    template: templateValue,
                    status: 'sent',
                    folder: 'sent'
                });
                return await memo.save();
            });
            createdMemos = await Promise.all(memoPromises);
        }

        // Fetch first memo with attachments included for response
        const populatedMemo = await Memo.findById(createdMemos[0]._id)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department')
            .lean();

        populatedMemo.attachments = createdMemos[0].attachments;

        // Trigger Google Drive backup asynchronously (non-blocking)
        // Only for Admin and Secretary roles, and only if Drive is connected
        if ((user.role === 'admin' || user.role === 'secretary')) {
            // Run backup in background - don't wait for it
            googleDriveService.uploadMemoToDrive(populatedMemo)
                .then((driveFileId) => {
                    // eslint-disable-next-line no-console
                    console.log(`✅ Memo backup to Google Drive successful: ${driveFileId}`);

                    // Optionally update memo with Drive file ID
                    Memo.findByIdAndUpdate(createdMemos[0]._id, {
                        googleDriveFileId: driveFileId
                    }).catch(err => {
                        // eslint-disable-next-line no-console
                        console.error('Failed to update memo with Drive ID:', err.message);
                    });
                })
                .catch((backupError) => {
                    // Log error but don't fail the memo creation
                    // eslint-disable-next-line no-console
                    console.error('⚠️ Google Drive backup failed (memo still saved):', backupError.message);
                    // eslint-disable-next-line no-console
                    console.error('  Backup error details:', {
                        subject: populatedMemo.subject,
                        error: backupError.message,
                        stack: backupError.stack
                    });
                });
        }

        res.status(201).json({
            success: true,
            memo: populatedMemo,
            count: createdMemos.length,
            message: isSecretary
                ? 'Your memo is pending for admin approval. It will be sent once approved.'
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

// Admin approve memo (uses workflow service)
exports.approveMemo = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }
        const { id } = req.params;
        // Resolve to original pending memo id if this id refers to a notification wrapper
        let targetId = id;
        try {
            const doc = await Memo.findById(id).lean();
            const meta = doc && doc.metadata;
            if (meta && (meta.originalMemoId || meta.relatedMemoId)) {
                targetId = meta.originalMemoId || meta.relatedMemoId;
            }
        } catch (e) {
            // ignore; fall back to provided id
        }
        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ success: false, message: 'Invalid original memo id' });
        }
        const updated = await approve({ memoId: targetId, adminUser: req.user });
        return res.json({ success: true, memo: updated, message: 'Memo approved and sent to recipients.' });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error approving memo:', error);
        res.status(500).json({ success: false, message: 'Error approving memo', detail: error?.message });
    }
};

// Admin reject memo (optional reason)
exports.rejectMemo = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }
        const { id } = req.params;
        const { reason } = req.body || {};
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid memo id' });
        }
        const updated = await reject({ memoId: id, adminUser: req.user, reason });
        return res.json({ success: true, memo: updated });
    } catch (error) {
        console.error('Error rejecting memo:', error);
        res.status(500).json({ success: false, message: 'Error rejecting memo' });
    }
};

// --- Templates & Signatures (minimal endpoints) ---
exports.getMemoTemplates = async (req, res) => {
    // Static minimal set for now; can be persisted later
    const templates = [
        { id: 'none', name: 'None' },
        { id: 'dean', name: 'Dean' },
        { id: 'faculty_president', name: 'Faculty President' },
        { id: 'dean_and_faculty_president', name: 'Dean + Faculty President' }
    ];
    res.json({ success: true, templates });
};

exports.getAllowedSignatures = async (req, res) => {
    try {
        const Signature = require('../models/Signature');
        const signatures = await Signature.find({ isActive: true })
            .select('_id roleTitle displayName imageUrl order')
            .sort({ order: 1, createdAt: -1 })
            .lean();

        // Transform to match frontend expectations
        const formatted = signatures.map(sig => ({
            id: sig._id.toString(),
            _id: sig._id.toString(),
            displayName: sig.displayName,
            roleTitle: sig.roleTitle,
            imageUrl: sig.imageUrl,
            order: sig.order || 0
        }));

        res.json({ success: true, signatures: formatted });
    } catch (e) {
        console.error('Error fetching signatures:', e);
        res.json({ success: true, signatures: [] });
    }
};

exports.previewMemo = async (req, res) => {
    try {
        const {
            subject = '',
            content = '',
            priority = 'medium',
            departments = [],
            template = 'none',
            signatures = [],
            inlineImages = []
        } = req.body || {};

        // Resolve signatures from database if template contains signature IDs (comma-separated)
        const Signature = require('../models/Signature');
        let signatureBlocks = [];

        if (template && template !== 'none'){
            try{
                // Template can be comma-separated IDs for multiple signatures
                const signatureIds = template.split(',').filter(id => id && id !== 'none');
                if (signatureIds.length > 0){
                    const dbSignatures = await Signature.find({ _id: { $in: signatureIds }, isActive: true }).lean();
                    signatureBlocks = dbSignatures.map(sig => ({
                        role: sig.roleTitle || '',
                        displayName: sig.displayName || sig.roleTitle || '',
                        img: sig.imageUrl || ''
                    }));
                }
            }catch(e){
                // Invalid ID or not found, ignore
            }
        }

        // Also check signatures array (for backward compatibility)
        if (signatureBlocks.length === 0 && signatures && signatures.length > 0){
            const signatureIds = signatures.map(s => s.signatureId).filter(Boolean);
            if (signatureIds.length > 0){
                const dbSignatures = await Signature.find({ _id: { $in: signatureIds }, isActive: true }).lean();
                signatureBlocks = dbSignatures.map(sig => ({
                    role: sig.roleTitle || '',
                    displayName: sig.displayName || sig.roleTitle || '',
                    img: sig.imageUrl || ''
                }));
            }
        }

        const esc = (t) => String(t || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Get signature names for preview meta
        let templateDisplay = '';
        if (signatureBlocks.length > 0){
            const names = signatureBlocks.map(b => esc(b.displayName || b.role)).join(', ');
            templateDisplay = ` • Signatures: ${names}`;
        }

        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Memo Preview</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color:#111827; margin:40px; }
    .header { border-bottom:1px solid #e5e7eb; padding-bottom:12px; margin-bottom:20px; }
    .meta { font-size: 12px; color:#6b7280; }
    h1 { font-size:20px; margin:0 0 8px 0; }
    .content { white-space: pre-wrap; line-height:1.6; margin-top: 12px; }
    .signatories { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-top:32px; }
    .sig { text-align:center; }
    .sig img { width: 220px; height: 70px; object-fit: contain; }
    .sig .name { font-weight:700; margin-top:6px; }
    .sig .title { color:#6b7280; font-size:13px; }
    .footer { margin-top:40px; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb; padding-top:8px; }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
<body>
  <div class="header">
    <h1>${esc(subject) || 'Untitled Memo'}</h1>
    <div class="meta">Priority: ${esc(priority)}${departments?.length ? ` • Departments: ${departments.map(esc).join(', ')}` : ''}${templateDisplay}</div>
  </div>
  <div class="content">${esc(content)}</div>
  ${ Array.isArray(inlineImages) && inlineImages.length ? `
  <div style="margin-top:20px; display:flex; gap:16px; flex-wrap:wrap; justify-content:flex-start;">
    ${ inlineImages.map(u => `<img src="${u}" alt="attachment" style="max-width:600px; max-height:400px; width:auto; height:auto; object-fit:contain; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">`).join('') }
  </div>` : '' }
  ${ signatureBlocks.length ? `
  <div class="signatories">
    ${signatureBlocks.map(b => `
      <div class="sig">
        ${ b.img ? `<img src="${b.img}" alt="${esc(b.role)} signature" />` : '' }
        <div class="name">${esc(b.displayName || b.role)}</div>
        <div class="title">${esc(b.role)}</div>
      </div>
    `).join('')}
  </div>` : '' }
  <div class="footer">Preview only • Not yet sent</div>
</body>
</html>`;

        const b64 = Buffer.from(html, 'utf8').toString('base64');
        const previewUrl = `data:text/html;base64,${b64}`;
        return res.json({ success: true, previewUrl, html });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Failed to build preview.' });
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
// Note: approveMemo implementation is defined earlier using the workflow service.

// Admin reject memo (uses workflow service)
exports.rejectMemo = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }
        const { id } = req.params;
        const { reason } = req.body || {};
        let targetId = id;
        try {
            const doc = await Memo.findById(id).lean();
            const meta = doc && doc.metadata;
            if (meta && (meta.originalMemoId || meta.relatedMemoId)) {
                targetId = meta.originalMemoId || meta.relatedMemoId;
            }
        } catch (e) {}
        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ success: false, message: 'Invalid original memo id' });
        }
        const updated = await reject({ memoId: targetId, adminUser: req.user, reason });
        return res.json({ success: true, memo: updated, message: 'Memo rejected and secretary notified.' });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error rejecting memo:', error);
        res.status(500).json({ success: false, message: 'Error rejecting memo', detail: error?.message });
    }
};

