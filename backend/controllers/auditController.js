const AuditLog = require('../models/AuditLog');

exports.getLogs = async (req, res) => {
    try {
        // Admins only
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10)));
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            AuditLog.countDocuments({})
        ]);
        res.json({ success: true, logs: items, page, total });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getLogById = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const log = await AuditLog.findById(req.params.id).lean();
        if (!log) {return res.status(404).json({ success: false, message: 'Not found' });}
        res.json({ success: true, log });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteLog = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const result = await AuditLog.findByIdAndDelete(req.params.id);
        if (!result) {return res.status(404).json({ success: false, message: 'Not found' });}
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


