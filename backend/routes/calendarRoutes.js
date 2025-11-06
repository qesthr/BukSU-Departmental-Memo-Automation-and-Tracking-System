const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const ctrl = require('../controllers/calendarController');

// Allow admin and secretary roles to access calendar
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

router.use(isAuthenticated, allowAdminOrSecretary);

router.get('/events', ctrl.list);
router.get('/events/:id', ctrl.getOne);
router.get('/events/:id/memo', ctrl.getEventMemo);
router.post('/events', ctrl.create);
router.put('/events/:id', ctrl.update);
router.patch('/events/:id/time', ctrl.updateTime);
router.delete('/events/:id', ctrl.remove);

module.exports = router;


