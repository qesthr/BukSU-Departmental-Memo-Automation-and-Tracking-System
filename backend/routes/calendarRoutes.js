const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const ctrl = require('../controllers/calendarController');

// Allow admin and secretary roles to access calendar (full access)
const allowAdminOrSecretary = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Invalid user' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'secretary') {
        return res.status(403).json({ message: 'Access denied. Admin or Secretary role required.' });
    }
    next();
};

// Allow faculty to view calendar events (read-only)
const allowFacultyView = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Invalid user' });
    }
    if (req.user.role === 'faculty') {
        return next();
    }
    return res.status(403).json({ message: 'Access denied.' });
};

// GET routes - allow faculty (view-only) and admin/secretary (full access)
router.get('/events', isAuthenticated, (req, res, next) => {
    if (req.user.role === 'faculty') {
        return allowFacultyView(req, res, next);
    }
    return allowAdminOrSecretary(req, res, next);
}, ctrl.list);

router.get('/events/:id', isAuthenticated, (req, res, next) => {
    if (req.user.role === 'faculty') {
        return allowFacultyView(req, res, next);
    }
    return allowAdminOrSecretary(req, res, next);
}, ctrl.getOne);

router.get('/events/:id/memo', isAuthenticated, (req, res, next) => {
    if (req.user.role === 'faculty') {
        return allowFacultyView(req, res, next);
    }
    return allowAdminOrSecretary(req, res, next);
}, ctrl.getEventMemo);

// POST/PUT/DELETE routes - only admin and secretary (no faculty)
router.use(isAuthenticated, allowAdminOrSecretary);

router.post('/events', ctrl.create);
router.put('/events/:id', ctrl.update);
router.patch('/events/:id/time', ctrl.updateTime);
router.post('/events/:id/archive', ctrl.archive);
router.delete('/events/:id', ctrl.remove);

module.exports = router;


