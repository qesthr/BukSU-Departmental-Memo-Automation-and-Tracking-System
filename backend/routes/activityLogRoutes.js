const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');

// All routes require authentication and admin role
router.use(isAuthenticated);
router.use(isAdmin);

// Get activity logs with filtering and pagination
router.get('/logs', activityLogController.getActivityLogs);

// Get single activity log by ID
router.get('/logs/:id', activityLogController.getActivityLogById);

// Export activity logs as CSV
router.get('/logs/export/csv', activityLogController.exportActivityLogs);

// Get activity log statistics
router.get('/stats', activityLogController.getActivityLogStats);

// Get search autocomplete suggestions
router.get('/suggestions', activityLogController.getSearchSuggestions);

module.exports = router;

