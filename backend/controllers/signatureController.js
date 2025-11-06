const Signature = require('../models/Signature');
const mongoose = require('mongoose');
const upload = require('../middleware/upload');

// Get all signatures (admin only for management)
exports.getAllSignatures = async (req, res) => {
    try {
        const signatures = await Signature.find()
            .populate('createdBy', 'firstName lastName email')
            .sort({ order: 1, createdAt: -1 });
        res.json({ success: true, signatures });
    } catch (error) {
        console.error('Error fetching signatures:', error);
        res.status(500).json({ success: false, message: 'Error fetching signatures' });
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

        // Handle image upload
        let imageUrl = '';
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
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

        // Handle image update if new file uploaded
        if (req.file) {
            signature.imageUrl = `/uploads/${req.file.filename}`;
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

// Delete signature (admin only)
exports.deleteSignature = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin only' });
        }

        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid signature ID' });
        }

        const signature = await Signature.findByIdAndDelete(id);
        if (!signature) {
            return res.status(404).json({ success: false, message: 'Signature not found' });
        }

        res.json({ success: true, message: 'Signature deleted successfully' });
    } catch (error) {
        console.error('Error deleting signature:', error);
        res.status(500).json({ success: false, message: 'Error deleting signature' });
    }
};

