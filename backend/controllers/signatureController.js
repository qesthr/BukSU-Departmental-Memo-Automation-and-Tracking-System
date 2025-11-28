const Signature = require('../models/Signature');
const mongoose = require('mongoose');
const upload = require('../middleware/upload');

// Get all signatures (admin only for management)
exports.getAllSignatures = async (req, res) => {
    try {
        const { includeArchived } = req.query;
        const query = {};

        // If includeArchived is not 'true', only get active signatures
        if (includeArchived !== 'true') {
            query.isActive = { $ne: false }; // Include active signatures and signatures without isActive set
        }

        const signatures = await Signature.find(query)
            .populate('createdBy', 'firstName lastName email')
            .sort({ order: 1, createdAt: -1 });

        // Get stats
        const activeQuery = { isActive: { $ne: false } };
        const stats = {
            total: await Signature.countDocuments(activeQuery),
            archived: await Signature.countDocuments({ isActive: false })
        };

        res.json({ success: true, signatures, stats });
    } catch (error) {
        console.error('Error fetching signatures:', error);
        res.status(500).json({ success: false, message: 'Error fetching signatures' });
    }
};

// Get archived signatures only
exports.getArchivedSignatures = async (req, res) => {
    try {
        const signatures = await Signature.find({ isActive: false })
            .populate('createdBy', 'firstName lastName email')
            .sort({ order: 1, createdAt: -1 });
        res.json({ success: true, signatures });
    } catch (error) {
        console.error('Error fetching archived signatures:', error);
        res.status(500).json({ success: false, message: 'Error fetching archived signatures' });
    }
};

// Get active signatures (for compose modal)
exports.getActiveSignatures = async (req, res) => {
    try {
        const signatures = await Signature.find({ isActive: true })
            .select('roleTitle displayName imageUrl order')
            .sort({ order: 1, createdAt: -1 });
        res.json({ success: true, signatures });
    } catch (error) {
        console.error('Error fetching active signatures:', error);
        res.json({ success: true, signatures: [] }); // Return empty on error
    }
};

// Create signature (admin only)
exports.createSignature = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }

        const { roleTitle, displayName, order } = req.body;

        if (!roleTitle || !displayName) {
            return res.status(400).json({ success: false, message: 'Role title and display name are required' });
        }

        // Check if role already exists
        const existing = await Signature.findOne({ roleTitle: roleTitle.trim() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Signature role already exists' });
        }

        // Handle image upload - convert to base64 data URL (same as profile pictures)
        let imageUrl = '';
        if (req.file) {
            const mimeType = req.file.mimetype || 'image/png';
            const base64Data = req.file.buffer?.toString('base64');
            if (!base64Data) {
                return res.status(400).json({ success: false, message: 'Invalid image data' });
            }
            imageUrl = `data:${mimeType};base64,${base64Data}`;
            console.log(`[Signature] Admin ${req.user.email || req.user._id} created signature "${roleTitle}" (stored ${base64Data.length} bytes in DB as base64).`);
        } else {
            return res.status(400).json({ success: false, message: 'Signature image is required' });
        }

        const signature = new Signature({
            roleTitle: roleTitle.trim(),
            displayName: displayName.trim(),
            imageUrl,
            order: order || 0,
            createdBy: req.user._id
        });

        await signature.save();
        const populated = await Signature.findById(signature._id)
            .populate('createdBy', 'firstName lastName email');

        res.status(201).json({ success: true, signature: populated });
    } catch (error) {
        console.error('Error creating signature:', error);
        res.status(500).json({ success: false, message: 'Error creating signature' });
    }
};

// Update signature (admin only)
exports.updateSignature = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid signature ID' });
        }

        const signature = await Signature.findById(id);
        if (!signature) {
            return res.status(404).json({ success: false, message: 'Signature not found' });
        }

        const { roleTitle, displayName, isActive, order } = req.body;

        if (roleTitle) {
            // Check if new roleTitle conflicts with another signature
            const existing = await Signature.findOne({
                roleTitle: roleTitle.trim(),
                _id: { $ne: id }
            });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Role title already exists' });
            }
            signature.roleTitle = roleTitle.trim();
        }

        if (displayName) signature.displayName = displayName.trim();
        if (typeof isActive === 'boolean') signature.isActive = isActive;
        if (typeof order === 'number') signature.order = order;

        // Handle image update if new file uploaded - convert to base64 data URL (same as profile pictures)
        if (req.file) {
            const mimeType = req.file.mimetype || 'image/png';
            const base64Data = req.file.buffer?.toString('base64');
            if (!base64Data) {
                return res.status(400).json({ success: false, message: 'Invalid image data' });
            }
            signature.imageUrl = `data:${mimeType};base64,${base64Data}`;
            console.log(`[Signature] Admin ${req.user.email || req.user._id} updated signature "${signature.roleTitle}" (stored ${base64Data.length} bytes in DB as base64).`);
        }

        await signature.save();
        const populated = await Signature.findById(signature._id)
            .populate('createdBy', 'firstName lastName email');

        res.json({ success: true, signature: populated });
    } catch (error) {
        console.error('Error updating signature:', error);
        res.status(500).json({ success: false, message: 'Error updating signature' });
    }
};

// Archive signature (admin only) - sets isActive to false
exports.deleteSignature = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid signature ID' });
        }

        const signature = await Signature.findById(id);
        if (!signature) {
            return res.status(404).json({ success: false, message: 'Signature not found' });
        }

        if (signature.isActive === false) {
            return res.status(400).json({ success: false, message: 'Signature is already archived' });
        }

        // Archive instead of delete
        signature.isActive = false;
        await signature.save();

        // Log activity
        const activityLogger = require('../services/activityLogger');
        const requestInfo = activityLogger.extractRequestInfo(req);
        await activityLogger.log(
            req.user,
            'signature_archived',
            `Archived signature: ${signature.displayName} (${signature.roleTitle})`,
            {
                targetResource: 'signature',
                targetId: signature._id,
                targetName: signature.displayName,
                ipAddress: requestInfo.ipAddress,
                userAgent: requestInfo.userAgent
            }
        );

        res.json({ success: true, message: 'Signature archived successfully' });
    } catch (error) {
        console.error('Error archiving signature:', error);
        res.status(500).json({ success: false, message: 'Error archiving signature' });
    }
};

// Unarchive signature (admin only) - sets isActive to true
exports.unarchiveSignature = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid signature ID' });
        }

        const signature = await Signature.findById(id);
        if (!signature) {
            return res.status(404).json({ success: false, message: 'Signature not found' });
        }

        if (signature.isActive === true) {
            return res.status(400).json({ success: false, message: 'Signature is already active' });
        }

        // Unarchive
        signature.isActive = true;
        await signature.save();

        // Log activity
        const activityLogger = require('../services/activityLogger');
        const requestInfo = activityLogger.extractRequestInfo(req);
        await activityLogger.log(
            req.user,
            'signature_updated',
            `Unarchived signature: ${signature.displayName} (${signature.roleTitle})`,
            {
                targetResource: 'signature',
                targetId: signature._id,
                targetName: signature.displayName,
                ipAddress: requestInfo.ipAddress,
                userAgent: requestInfo.userAgent
            }
        );

        res.json({ success: true, message: 'Signature unarchived successfully' });
    } catch (error) {
        console.error('Error unarchiving signature:', error);
        res.status(500).json({ success: false, message: 'Error unarchiving signature' });
    }
};

