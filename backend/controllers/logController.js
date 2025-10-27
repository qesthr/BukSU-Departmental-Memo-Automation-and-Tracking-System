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

        const memo = new Memo({
            sender: userId,
            recipient: recipient._id,
            subject,
            content,
            department,
            priority,
            attachments: attachments,
            status: 'sent'
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

        // Fetch with attachments included
        const populatedMemo = await Memo.findById(memo._id)
            .populate('sender', 'firstName lastName email profilePicture department')
            .populate('recipient', 'firstName lastName email profilePicture department')
            .lean();

        // Explicitly add attachments to populatedMemo
        populatedMemo.attachments = memo.attachments;

        // Create log entry in admin's inbox (non-blocking - don't fail if logging fails)
        try {
            const logService = require('../services/logService');
            logService.logMemoSent(populatedMemo).catch(err => {
                // eslint-disable-next-line no-console
                console.error('Failed to create log entry (non-critical):', err);
            });
        } catch (logErr) {
            // eslint-disable-next-line no-console
            console.error('Could not load log service:', logErr.message);
        }

        // Auto-save to Google Drive if connected system-wide (non-blocking)
        try {
            const googleDriveService = require('../services/googleDriveService');
            const isConnected = await googleDriveService.isDriveConnected();

            // eslint-disable-next-line no-console
            console.log(`[Google Drive] Connection status: ${isConnected}`);
            // eslint-disable-next-line no-console
            console.log(`[Google Drive] Memo has ${populatedMemo.attachments?.length || 0} attachments`);

            if (isConnected) {
                // eslint-disable-next-line no-console
                console.log(`[Google Drive] Attempting to upload memo: ${populatedMemo.subject}`);

                // Pass attachments to the upload function
                googleDriveService.uploadMemoToDrive(populatedMemo)
                    .then(fileId => {
                        // Update the memo document with Google Drive file ID
                        Memo.findByIdAndUpdate(memo._id, { googleDriveFileId: fileId })
                            .catch(err => {
                                // eslint-disable-next-line no-console
                                console.error('Failed to save Google Drive file ID:', err);
                            });
                        // eslint-disable-next-line no-console
                        console.log(`✓ Memo backed up to Google Drive: ${fileId}`);
                        // eslint-disable-next-line no-console
                        console.log(`  Memo: ${populatedMemo.subject}`);
                    })
                    .catch(err => {
                        // eslint-disable-next-line no-console
                        console.error('✗ Failed to backup memo to Google Drive:', err.message);
                        // eslint-disable-next-line no-console
                        console.error('  Error details:', err);
                    });
            } else {
                // eslint-disable-next-line no-console
                console.log(`[Google Drive] NOT connected - memo will NOT be backed up`);
                // eslint-disable-next-line no-console
                console.log(`  To connect: An admin must visit /api/drive/authorize`);
            }
        } catch (driveErr) {
            // eslint-disable-next-line no-console
            console.error('✗ Error checking Google Drive connection:', driveErr.message);
            // eslint-disable-next-line no-console
            console.error('  Error details:', driveErr);
        }

        res.status(201).json({ success: true, memo: populatedMemo });
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

