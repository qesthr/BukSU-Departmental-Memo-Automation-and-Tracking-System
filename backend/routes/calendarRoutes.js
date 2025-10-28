const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/calendarController');

router.use(isAuthenticated, isAdmin);

router.get('/events', ctrl.list);
router.post('/events', ctrl.create);
router.put('/events/:id', ctrl.update);
router.patch('/events/:id/time', ctrl.updateTime);
router.delete('/events/:id', ctrl.remove);

module.exports = router;


