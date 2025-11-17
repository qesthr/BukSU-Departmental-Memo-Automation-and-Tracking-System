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

        // System-generated activity types to exclude from memo inboxes
        const systemActivityTypes = [
            'user_activity',
            'system_notification',
            'user_deleted',
            'password_reset',
            'welcome_email'
        ];

        if (folder === 'inbox') {
            // For admins, show both sent and received memos
            const user = await User.findById(userId);
            if (user.role === 'admin') {
                // Admin inbox: show both memos sent BY admin and received BY admin
                query = {
                    $or: [
                        { sender: userId },
                        { recipient: userId }
                    ],
                    status: { $nin: ['deleted','archived'] },
                    activityType: { $nin: systemActivityTypes }
                };
            } else {
                // Regular users: only delivered memos (hide pending workflow items)
                // Status filter already excludes pending, so secretaries won't see their own pending memos
                query = {
                    recipient: userId,
                    status: { $in: ['sent','approved'] },
                    activityType: { $nin: systemActivityTypes }
                };
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
        } else if (folder === 'archive') {
            // For archive folder, show archived, sent, or approved memos sent by user
            // Exclude memos where user is the recipient (tracking memos)
            query = {
                sender: userId,
                recipient: { $ne: userId }, // Exclude memos sent to the user themselves
                status: { $in: ['archived', 'sent', 'approved'] },
                activityType: { $ne: 'system_notification' }
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

        // Ensure signatures are included in all memos
        const memosWithSignatures = memos.map(memo => {
            const memoObj = memo.toObject ? memo.toObject() : memo;
            if (!memoObj.signatures) {
                memoObj.signatures = [];
            }
            return memoObj;
        });

        res.json({ success: true, memos: memosWithSignatures });
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

        // Convert to plain object to ensure all fields including signatures are included
        const memoObj = memo.toObject ? memo.toObject() : memo;

        // Ensure signatures array is included (even if empty)
        if (!memoObj.signatures) {
            memoObj.signatures = [];
        }

        res.json({ success: true, memo: memoObj });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching memo:', error);
        res.status(500).json({ success: false, message: 'Error fetching memo' });
    }
};

// Download memo as PDF
exports.downloadMemo = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid memo id' });
        }

        const memo = await Memo.findById(id)
            .populate('sender', 'firstName lastName email profilePicture department role')
            .populate('recipient', 'firstName lastName email profilePicture department role');

        if (!memo) {
            return res.status(404).json({ success: false, message: 'Memo not found' });
        }

        const userId = req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        const isPendingAdmin = memo.status === 'pending' || memo.status === 'PENDING_ADMIN' || memo.status === 'pending_admin';
        const isSender = memo.sender?._id?.toString() === userId;
        const isRecipient = memo.recipient?._id?.toString() === userId;

        if (!isSender && !isRecipient && !(isAdmin && isPendingAdmin)) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (memo.recipient?._id && memo.recipient._id.toString() === userId && !memo.isRead) {
            memo.isRead = true;
            memo.readAt = new Date();
            await memo.save();
        }

        const memoObj = memo.toObject ? memo.toObject() : memo;
        memoObj.attachments = memoObj.attachments || [];
        memoObj.signatures = memoObj.signatures || [];

        const sanitizedContent = sanitizeHTML(memoObj.content);
        const plainContent = htmlToPlainText(sanitizedContent);

        // Extract inline images from HTML content
        const inlineImages = [];
        if (sanitizedContent) {
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            let match;
            while ((match = imgRegex.exec(sanitizedContent)) !== null) {
                const imgSrc = match[1];
                if (imgSrc && !imgSrc.startsWith('data:')) {
                    inlineImages.push(imgSrc);
                }
            }
        }

        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        const chunks = [];
        let pdfError = null;

        // Helper function to ensure space on page
        const ensureSpace = (requiredHeight) => {
            const pageHeight = doc.page.height;
            const bottomMargin = 50;
            const currentY = doc.y;
            const availableHeight = pageHeight - currentY - bottomMargin;
            if (availableHeight < requiredHeight) {
                doc.addPage();
                return true;
            }
            return false;
        };

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', (err) => {
            pdfError = err;
            // eslint-disable-next-line no-console
            console.error('Error generating memo PDF:', err);
        });

        doc.on('end', () => {
            if (pdfError) {
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Error generating memo PDF' });
                }
                return;
            }
            const pdfBuffer = Buffer.concat(chunks);
            const filename = `${createSafeFilename(memoObj.subject || 'Memo')}.pdf`;
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Length', pdfBuffer.length);
            }
            res.send(pdfBuffer);
        });

        // Title - larger and bold
        doc.font('Helvetica-Bold').fontSize(24).fillColor('#111827').text('MEMO', { align: 'center' });
        doc.moveDown(2);

        const senderName = memo.sender ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim() : 'N/A';
        const recipientName = memo.recipient ? `${memo.recipient.firstName || ''} ${memo.recipient.lastName || ''}`.trim() : 'N/A';
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        // Memo details with better spacing
        doc.font('Helvetica').fontSize(12).fillColor('#111827')
            .text(`Subject: ${memoObj.subject || 'No subject'}`)
            .moveDown(0.4)
            .text(`From: ${senderName || 'N/A'}${memo.sender?.email ? ` (${memo.sender.email})` : ''}`)
            .moveDown(0.4)
            .text(`To: ${recipientName || 'N/A'}${memo.recipient?.email ? ` (${memo.recipient.email})` : ''}`)
            .moveDown(0.4)
            .text(`Department: ${memoObj.department || 'N/A'}`)
            .moveDown(0.4)
            .text(`Priority: ${memoObj.priority || 'medium'}`)
            .moveDown(0.4)
            .text(`Date: ${memoObj.createdAt ? new Date(memoObj.createdAt).toLocaleString() : new Date().toLocaleString()}`);

        doc.moveDown(1.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1.5);

        // Content with better formatting
        if (plainContent) {
            doc.fontSize(12).fillColor('#111827').text(plainContent, { align: 'left', lineGap: 6, paragraphGap: 8 });
        } else {
            doc.fontSize(12).fillColor('#6b7280').font('Helvetica-Oblique').text('(No memo content)');
            doc.font('Helvetica');
        }

        // Embed inline images from content
        if (inlineImages.length > 0) {
            doc.moveDown(1.5);
            for (const imgSrc of inlineImages) {
                try {
                    let imagePath = imgSrc;
                    if (imgSrc.startsWith('/uploads/')) {
                        imagePath = path.join(__dirname, '../../uploads', path.basename(imgSrc));
                    } else if (imgSrc.startsWith('uploads/')) {
                        imagePath = path.join(__dirname, '../../uploads', path.basename(imgSrc));
                    } else if (!path.isAbsolute(imgSrc)) {
                        imagePath = path.join(__dirname, '../../uploads', path.basename(imgSrc));
                    }

                    if (fs.existsSync(imagePath)) {
                        ensureSpace(450);
                        const maxWidth = 450;
                        const maxHeight = 400;
                        const imageY = doc.y;

                        // Embed the image
                        doc.image(imagePath, 50, imageY, { fit: [maxWidth, maxHeight], align: 'left' });

                        // Move down by max possible height plus minimal spacing
                        // Reduced spacing to allow signatures to use available space below
                        doc.y = imageY + maxHeight + 15; // Use maxHeight + 15px minimal spacing

                        // Double-check: if we somehow went past the page, add a new page
                        const pageHeight = doc.page.height;
                        const bottomMargin = 50;
                        if (doc.y > pageHeight - bottomMargin) {
                            doc.addPage();
                        }
                    }
                } catch (imgError) {
                    // eslint-disable-next-line no-console
                    console.warn('Could not embed inline image:', imgError.message);
                }
            }
        }

        if (memoObj.attachments.length > 0) {
            doc.moveDown(2);
            // Removed "Attachments:" label as requested
            for (const attachment of memoObj.attachments) {
                const filename = attachment.filename || 'attachment';
                const sizeInfo = attachment.size ? ` (${formatBytes(attachment.size)})` : '';
                let attachmentUrl = attachment.url || `/uploads/${encodeURIComponent(filename)}`;
                if (!/^https?:\/\//i.test(attachmentUrl)) {
                    attachmentUrl = `${baseUrl}${attachmentUrl.startsWith('/') ? '' : '/'}${attachmentUrl}`;
                }

                const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

                if (isImage) {
                    // Try to find the file
                    let filePath = attachment.path;
                    if (!filePath || !fs.existsSync(filePath)) {
                        filePath = path.join(__dirname, '../../uploads', filename);
                    }
                    if (!fs.existsSync(filePath)) {
                        filePath = path.join(__dirname, '../../uploads', path.basename(filename));
                    }

                    if (fs.existsSync(filePath)) {
                        try {
                            // Ensure we have enough space for the image
                            ensureSpace(450);
                            const maxWidth = 450;
                            const maxHeight = 400;
                            const imageY = doc.y;

                            // Embed the image - PDFKit will scale it to fit within maxWidth x maxHeight
                            doc.image(filePath, 50, imageY, { fit: [maxWidth, maxHeight], align: 'left' });

                            // Move down by max possible height plus minimal spacing
                            // Reduced spacing to allow signatures to use available space below
                            doc.y = imageY + maxHeight + 15; // Use maxHeight + 15px minimal spacing

                            // Double-check: if we somehow went past the page, add a new page
                            const pageHeight = doc.page.height;
                            const bottomMargin = 50;
                            if (doc.y > pageHeight - bottomMargin) {
                                doc.addPage();
                            }
                        } catch (imgError) {
                            // eslint-disable-next-line no-console
                            console.warn(`Could not embed image ${filename}:`, imgError.message);
                            // If image can't be embedded, just show filename without link
                            doc.moveDown(0.4);
                            doc.fontSize(11).fillColor('#111827').text(`• ${filename}${sizeInfo}`);
                            doc.moveDown(0.5);
                        }
                    } else {
                        // File not found - just show filename without link
                        doc.moveDown(0.4);
                        doc.fontSize(11).fillColor('#111827').text(`• ${filename}${sizeInfo}`);
                        doc.moveDown(0.5);
                    }
                } else {
                    // Non-image attachments - show filename with link (for PDFs, docs, etc.)
                    doc.moveDown(0.4);
                    doc.fontSize(11).fillColor('#111827').text(`• ${filename}${sizeInfo}`);
                    doc.fontSize(10).fillColor('#2563eb').text(attachmentUrl, {
                        link: attachmentUrl,
                        underline: true
                    });
                    doc.fillColor('#111827');
                    doc.moveDown(0.5);
                }
            }
            // Removed extra spacing - use available space for signatures
        }

        if (memoObj.signatures.length > 0) {
            // Smart signature placement: use available space below images, only add new page if needed
            const pageHeight = doc.page.height;
            const bottomMargin = 50;
            const currentY = doc.y;
            const availableHeight = pageHeight - currentY - bottomMargin;

            // Estimate required space for signatures (depends on number of signatures)
            const numSignatures = memoObj.signatures.length;
            const numRows = Math.ceil(numSignatures / 2);
            const signatureSectionHeight = (numRows * 120) + 50; // ~120px per row + spacing

            // Only add new page if we truly don't have enough space
            // Otherwise, use the available space below images
            if (availableHeight < signatureSectionHeight) {
                doc.addPage();
            } else {
                // Use available space - just add a small gap
                doc.moveDown(1);
            }

            // Add divider before signatures
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(1.5);

            // Removed "Signatories:" label as requested
            // Start directly with signatures

            // Display signatures in a grid layout (2 per row, centered)
            const signatureWidth = numSignatures === 1 ? 220 : 220; // Consistent width
            const signatureSpacing = numSignatures > 1 ? 50 : 0;
            // Center single signature, or align left for multiple
            const startX = numSignatures === 1 ? (297.5 - signatureWidth / 2) : 50; // Center on page if only one

            for (let i = 0; i < numSignatures; i += 2) {
                const sig1 = memoObj.signatures[i];
                const sig2 = memoObj.signatures[i + 1];

                ensureSpace(150);
                const rowStartY = doc.y;

                // Process first signature
                if (sig1) {
                    const sig1X = startX;
                    let currentY = rowStartY;

                    // Embed signature image first
                    if (sig1.imageUrl) {
                        try {
                            let sigImagePath = sig1.imageUrl;
                            if (sigImagePath.startsWith('/uploads/') || sigImagePath.startsWith('uploads/')) {
                                sigImagePath = path.join(__dirname, '../../uploads', path.basename(sigImagePath));
                            } else if (!path.isAbsolute(sigImagePath)) {
                                sigImagePath = path.join(__dirname, '../../uploads', path.basename(sigImagePath));
                            }

                            if (fs.existsSync(sigImagePath)) {
                                const imageHeight = 60;
                                doc.image(sigImagePath, sig1X, currentY, {
                                    fit: [signatureWidth, imageHeight]
                                });
                                currentY += imageHeight + 8;
                            }
                        } catch (sigError) {
                            // eslint-disable-next-line no-console
                            console.warn('Could not embed signature image:', sigError.message);
                            currentY += 60 + 8;
                        }
                    } else {
                        currentY += 60 + 8;
                    }

                    // Add name (centered)
                    const name = sig1.displayName || sig1.role || 'Signature';
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827')
                        .text(name, sig1X, currentY, {
                            width: signatureWidth,
                            align: 'center'
                        });
                    currentY += 15;

                    // Add title (centered, gray)
                    const title = sig1.roleTitle || sig1.role || '';
                    if (title) {
                        doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
                            .text(title, sig1X, currentY, {
                                width: signatureWidth,
                                align: 'center'
                            });
                    }
                    doc.fillColor('#111827');
                }

                // Process second signature (if exists)
                if (sig2) {
                    const sig2X = startX + signatureWidth + signatureSpacing;
                    let currentY = rowStartY;

                    // Embed signature image first
                    if (sig2.imageUrl) {
                        try {
                            let sigImagePath = sig2.imageUrl;
                            if (sigImagePath.startsWith('/uploads/') || sigImagePath.startsWith('uploads/')) {
                                sigImagePath = path.join(__dirname, '../../uploads', path.basename(sigImagePath));
                            } else if (!path.isAbsolute(sigImagePath)) {
                                sigImagePath = path.join(__dirname, '../../uploads', path.basename(sigImagePath));
                            }

                            if (fs.existsSync(sigImagePath)) {
                                const imageHeight = 60;
                                doc.image(sigImagePath, sig2X, currentY, {
                                    fit: [signatureWidth, imageHeight]
                                });
                                currentY += imageHeight + 8;
                            }
                        } catch (sigError) {
                            // eslint-disable-next-line no-console
                            console.warn('Could not embed signature image:', sigError.message);
                            currentY += 60 + 8;
                        }
                    } else {
                        currentY += 60 + 8;
                    }

                    // Add name (centered)
                    const name = sig2.displayName || sig2.role || 'Signature';
                    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827')
                        .text(name, sig2X, currentY, {
                            width: signatureWidth,
                            align: 'center'
                        });
                    currentY += 15;

                    // Add title (centered, gray)
                    const title = sig2.roleTitle || sig2.role || '';
                    if (title) {
                        doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
                            .text(title, sig2X, currentY, {
                                width: signatureWidth,
                                align: 'center'
                            });
                    }
                    doc.fillColor('#111827');
                }

                // Calculate max height for this row
                let sig1Height = 0;
                let sig2Height = 0;

                if (sig1) {
                    sig1Height = 60 + 8; // Image + spacing
                    sig1Height += 15; // Name
                    if (sig1.roleTitle) sig1Height += 12; // Title
                }

                if (sig2) {
                    sig2Height = 60 + 8; // Image + spacing
                    sig2Height += 15; // Name
                    if (sig2.roleTitle) sig2Height += 12; // Title
                }

                const maxHeight = Math.max(sig1Height, sig2Height);
                doc.y = rowStartY + maxHeight + 20;
            }
        }

        doc.end();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error preparing memo download:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Error generating memo PDF' });
        }
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

function htmlToPlainText(html) {
    if (!html) {return '';}
    let text = html;
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<li>/gi, '\n• ');
    text = text.replace(/<\/li>/gi, '');
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, '\'');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\r/g, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}

function formatBytes(bytes) {
    if (!bytes || Number.isNaN(bytes)) {return '0 B';}
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size < 10 && unitIndex > 0 ? size.toFixed(1) : Math.round(size)} ${units[unitIndex]}`;
}

function createSafeFilename(subject) {
    if (!subject) {return 'Memo';}
    return subject
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '_')
        .trim()
        .substring(0, 80) || 'Memo';
}

// Create a new memo
exports.createMemo = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
        const { recipientEmail, subject, content, departments, priority, template, eventDate, eventTime, eventEndDate, eventEndTime, allDay, scheduledSendAt } = req.body;

        // Parse scheduledSendAt if provided
        let scheduledSendDate = null;
        if (scheduledSendAt) {
            scheduledSendDate = new Date(scheduledSendAt);
            // Validate it's a future date
            if (isNaN(scheduledSendDate.getTime()) || scheduledSendDate <= new Date()) {
                scheduledSendDate = null;
            }
        }

        const isScheduled = scheduledSendDate !== null;

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
                    }).select('_id email');
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
                        template: templateValue,
                        metadata: {
                            eventDate: eventDate || null,
                            eventTime: eventTime || null,
                            allDay: allDay || 'false',
                            scheduledSendAt: isScheduled ? scheduledSendDate.toISOString() : null
                        }
                    }
                });
                createdMemos = [workflowMemo];
            } catch (e) {
                console.error('Error creating pending memo via workflow:', e);
                return res.status(500).json({ success: false, message: 'Error creating pending memo' });
            }
        } else {
            // Non-secretaries: send immediately or schedule
            const memoStatus = isScheduled ? 'scheduled' : 'sent';
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
                    status: memoStatus,
                    folder: isScheduled ? 'drafts' : 'sent',
                    scheduledSendAt: isScheduled ? scheduledSendDate : undefined
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

        // Create calendar event if date/time is provided
        if (eventDate && createdMemos.length > 0) {
            try {
                const CalendarEvent = require('../models/CalendarEvent');

                // Parse date and time (Start and End)
                const isAllDay = allDay === 'true' || allDay === true;
                let startDate, endDate;

                if (isAllDay) {
                    // All-day event: start at 00:00, end at 23:59:59
                    startDate = new Date(eventDate);
                    startDate.setHours(0, 0, 0, 0);
                    // Use End date if provided, otherwise use Start date
                    const endDateValue = eventEndDate || eventDate;
                    endDate = new Date(endDateValue);
                    endDate.setHours(23, 59, 59, 999);
                } else if (eventTime) {
                    // Timed event: combine Start date and time
                    const [hours, minutes] = eventTime.split(':');
                    startDate = new Date(eventDate);
                    startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

                    // Use End date/time if provided, otherwise default to 1 hour after Start
                    if (eventEndDate && eventEndTime) {
                        const [endHours, endMinutes] = eventEndTime.split(':');
                        endDate = new Date(eventEndDate);
                        endDate.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0, 0);
                    } else if (eventEndDate) {
                        // End date provided but no time - use end of day
                        endDate = new Date(eventEndDate);
                        endDate.setHours(23, 59, 59, 999);
                    } else {
                        // Default duration: 1 hour after Start
                        endDate = new Date(startDate);
                        endDate.setHours(endDate.getHours() + 1);
                    }
                } else {
                    // Date only: treat as all-day
                    startDate = new Date(eventDate);
                    startDate.setHours(0, 0, 0, 0);
                    const endDateValue = eventEndDate || eventDate;
                    endDate = new Date(endDateValue);
                    endDate.setHours(23, 59, 59, 999);
                }

                // Get all recipient emails and departments for participants
                const recipientEmails = [];
                const recipientDepartments = new Set();

                // Add individual recipient emails
                if (recipientEmail) {
                    const emails = recipientEmail.split(',').map(e => e.trim().toLowerCase());
                    recipientEmails.push(...emails);
                }

                // Add departments
                const departmentsArray = Array.isArray(departments) ? departments : (departments ? [departments] : []);
                departmentsArray.forEach(dept => {
                    if (dept) recipientDepartments.add(dept);
                });

                // Get emails from recipient IDs
                const recipientUsers = await User.find({ _id: { $in: recipientIds } }).select('email department').lean();
                recipientUsers.forEach(ru => {
                    if (ru.email) recipientEmails.push(ru.email.toLowerCase());
                    if (ru.department) recipientDepartments.add(ru.department);
                });

                // Add creator's email to participants so it appears in their calendar
                if (user && user.email) {
                    recipientEmails.push(user.email.toLowerCase());
                }

                // Map priority to calendar category
                const categoryMap = {
                    'urgent': 'urgent',
                    'high': 'high',
                    'medium': 'standard',
                    'low': 'low'
                };
                const category = categoryMap[priority] || 'standard';

                // Create calendar event (appears immediately in calendars, even for scheduled memos)
                const calendarEvent = new CalendarEvent({
                    title: subject.trim(),
                    start: startDate,
                    end: endDate,
                    allDay: isAllDay,
                    category: category,
                    description: content || '',
                    participants: {
                        emails: [...new Set(recipientEmails)], // Remove duplicates, includes creator
                        departments: Array.from(recipientDepartments)
                    },
                    memoId: createdMemos[0]._id,
                    createdBy: userId,
                    status: isScheduled ? 'scheduled' : 'confirmed'
                });

                await calendarEvent.save();

                // Update memo with calendar event reference
                await Memo.findByIdAndUpdate(createdMemos[0]._id, {
                    'metadata.calendarEventId': calendarEvent._id,
                    'metadata.hasCalendarEvent': true
                });

                console.log(`✅ Calendar event created for memo: ${subject} (Event ID: ${calendarEvent._id})`);
            } catch (calendarError) {
                // Log error but don't fail memo creation
                console.error('⚠️ Failed to create calendar event (memo still saved):', calendarError.message);
            }
        }

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
            message: isScheduled
                ? `Memo scheduled successfully. It will be sent on ${scheduledSendDate.toLocaleDateString()} at ${scheduledSendDate.toLocaleTimeString()}.`
                : isSecretary
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
        // Get all active signatures - no additional filtering
        const signatures = await Signature.find({ isActive: true })
            .select('_id roleTitle displayName imageUrl order')
            .sort({ order: 1, createdAt: -1 })
            .lean();

        // eslint-disable-next-line no-console
        console.log(`  📝 Found ${signatures.length} active signature(s) for template dropdown`);

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
        // eslint-disable-next-line no-console
        console.error('Error fetching signatures:', e);
        res.json({ success: true, signatures: [] });
    }
};

exports.previewMemo = async (req, res) => {
    try {
        // Extract ONLY compose form data - exclude any UI elements
        let {
            subject = '',
            content = '',
            priority = 'medium',
            departments = [],
            recipients = [],
            template = 'none',
            signatures = [],
            inlineImages = []
        } = req.body || {};

        // Ensure content is a string and strip any accidental HTML
        if (typeof content !== 'string') {
            content = String(content || '');
        }
        // Remove any HTML tags that might have been accidentally included
        content = content.replace(/<[^>]*>/g, '');

        // Ensure recipients is an array
        if (!Array.isArray(recipients)) {
            recipients = [];
        }

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

        // Enhanced escape function that also removes HTML tags and special characters
        const esc = (t) => {
            if (!t) return '';
            let str = String(t);
            // First, remove any HTML tags completely
            str = str.replace(/<[^>]*>/g, '');
            // Then escape remaining special characters
            str = str.replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;')
                     .replace(/"/g, '&quot;')
                     .replace(/'/g, '&#39;');
            return str;
        };

        // Get signature names for preview meta
        let templateDisplay = '';
        if (signatureBlocks.length > 0){
            const names = signatureBlocks.map(b => esc(b.displayName || b.role)).join(', ');
            templateDisplay = ` • Signatures: ${names}`;
        }

        // Clean content - remove any HTML and ensure it's plain text
        let cleanContent = String(content || '').trim();

        // First, aggressively remove all HTML tags and form elements
        cleanContent = cleanContent
            // Remove complete form elements with their content (non-greedy)
            .replace(/<select[^>]*>[\s\S]*?<\/select>/gi, '')
            .replace(/<input[^>]*>[\s\S]*?<\/input>/gi, '')
            .replace(/<input[^>]*\/?>/gi, '')
            .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
            .replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/gi, '')
            .replace(/<label[^>]*>[\s\S]*?<\/label>/gi, '')
            .replace(/<div[^>]*class[^>]*select[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<div[^>]*class[^>]*dropdown[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, '')
            .replace(/<li[^>]*>[\s\S]*?<\/li>/gi, '')
            // Remove any remaining HTML tags
            .replace(/<[^>]+>/g, '');

        // Remove checkbox/radio Unicode characters that might appear as boxes
        cleanContent = cleanContent
            .replace(/[☐☑☒✓✔✗✘]/g, '')
            .replace(/[\u2610-\u2612]/g, '') // Box drawing checkboxes
            .replace(/[\u2713-\u2717]/g, ''); // Check marks

        // Decode HTML entities that might be in the content
        cleanContent = cleanContent
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'");

        // Then escape it properly for display
        cleanContent = esc(cleanContent);

        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Memo Preview</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      overflow: auto;
    }
    body {
      font-family: Inter, Arial, sans-serif;
      color:#111827;
      margin:40px;
      background: #fff;
      overflow-x: hidden;
    }
    .header {
      border-bottom:1px solid #e5e7eb;
      padding-bottom:12px;
      margin-bottom:20px;
    }
    .meta {
      font-size: 12px;
      color:#6b7280;
      line-height: 1.8;
    }
    .meta div {
      margin-bottom: 4px;
    }
    .meta strong {
      color: #374151;
      font-weight: 600;
    }
    h1 {
      font-size:20px;
      margin:0 0 8px 0;
    }
    .content {
      white-space: pre-wrap;
      line-height:1.6;
      margin-top: 12px;
      position: relative;
      overflow: visible;
      word-wrap: break-word;
    }
    .content::before,
    .content::after {
      display: none !important;
      content: none !important;
    }
    /* Hide ALL form elements and dropdowns anywhere in the document */
    input,
    button,
    select,
    textarea,
    [type="checkbox"],
    [type="radio"],
    .dropdown,
    .select,
    .custom-dropdown,
    .dept-dropdown-menu,
    .template-dropdown-menu,
    .checkbox-control,
    .select-dropdown-wrapper,
    .select-dropdown-btn,
    .select-dropdown-menu {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      position: absolute !important;
      left: -9999px !important;
      pointer-events: none !important;
    }
    .content input,
    .content button,
    .content select,
    .content textarea,
    .content [type="checkbox"],
    .content [type="radio"],
    .content .dropdown,
    .content .select {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      position: absolute !important;
      left: -9999px !important;
    }
    .content [data-lucide],
    .content i[class*="lucide"],
    .content svg,
    .content .lucide-icon {
      display: none !important;
      visibility: hidden !important;
    }
    .signatories {
      display:grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap:16px;
      margin-top:32px;
    }
    .sig {
      text-align:center;
    }
    .sig img {
      width: 220px;
      height: 70px;
      object-fit: contain;
    }
    .sig .name {
      font-weight:700;
      margin-top:6px;
    }
    .sig .title {
      color:#6b7280;
      font-size:13px;
    }
    .footer {
      margin-top:40px;
      font-size:12px;
      color:#6b7280;
      border-top:1px solid #e5e7eb;
      padding-top:8px;
    }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
<body>
  <div class="header">
    <h1>${esc(subject) || 'Untitled Memo'}</h1>
    <div class="meta">
      ${recipients && recipients.length > 0 ? `<div style="margin-bottom:8px;"><strong>To:</strong> ${recipients.map(r => esc(r.name || r.email || '')).filter(Boolean).join(', ')}</div>` : ''}
      <div><strong>Priority:</strong> ${esc(priority)}</div>
      ${departments?.length ? `<div><strong>Department(s):</strong> ${departments.map(esc).join(', ')}</div>` : ''}
      ${templateDisplay ? `<div>${templateDisplay}</div>` : ''}
    </div>
  </div>
  <div class="content">${cleanContent}</div>
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

// Department users (for secretary search) - Only fetch faculty members
exports.getDepartmentUsers = async (req, res) => {
    try {
        const department = req.user.department;
        console.log('getDepartmentUsers - User department:', department);
        console.log('getDepartmentUsers - User ID:', req.user._id);
        console.log('getDepartmentUsers - User role:', req.user.role);

        if (!department) {
            console.log('getDepartmentUsers - No department found for user');
            return res.json({ success: true, users: [] });
        }

        const User = require('../models/User');

        // Trim and normalize department name for comparison (case-insensitive)
        const normalizedDept = department.trim();

        // Only fetch faculty members from the department (case-insensitive match)
        const users = await User.find({
            role: 'faculty',
            department: { $regex: new RegExp(`^${normalizedDept}$`, 'i') }
        })
            .select('_id email firstName lastName role department profilePicture')
            .sort({ firstName: 1, lastName: 1 });

        console.log('getDepartmentUsers - Found users:', users.length);
        console.log('getDepartmentUsers - Users:', users.map(u => ({ name: `${u.firstName} ${u.lastName}`, email: u.email, dept: u.department })));

        // Also check what departments exist in the database for debugging
        const allDepts = await User.distinct('department', { role: 'faculty' });
        console.log('getDepartmentUsers - All departments with faculty:', allDepts);

        res.json({ success: true, users });
    } catch (e) {
        console.error('Error fetching department users:', e);
        res.status(500).json({ success: false, message: 'Error fetching department users', error: e.message });
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

