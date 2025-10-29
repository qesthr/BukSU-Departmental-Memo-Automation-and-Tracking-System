const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');
const logController = require('../controllers/logController');
const dashboardController = require('../controllers/dashboardController');
const notificationController = require('../controllers/notificationController');
const upload = require('../middleware/upload');

// Get all memos
router.get('/memos', [isAuthenticated], logController.getAllMemos);

// Get single memo
router.get('/memos/:id', [isAuthenticated], logController.getMemo);

// Create memo (with file upload support)
router.post('/memos', [isAuthenticated, upload.array('attachments', 10)], logController.createMemo);

// Update memo
router.put('/memos/:id', [isAuthenticated], logController.updateMemo);

// Delete memo (soft delete)
router.delete('/memos/:id', [isAuthenticated], logController.deleteMemo);

// Restore deleted memo
router.put('/memos/:id/restore', [isAuthenticated], logController.restoreMemo);

// Permanently delete memo
router.delete('/memos/:id/permanent', [isAuthenticated], logController.permanentDelete);

// Admin moderation actions
router.put('/memos/:id/approve', [isAuthenticated, isAdmin], logController.approveMemo);
router.put('/memos/:id/reject', [isAuthenticated, isAdmin], logController.rejectMemo);

// Secretary distribution helpers
router.get('/department-users', [isAuthenticated], logController.getDepartmentUsers);
router.post('/memos/distribute', [isAuthenticated], logController.distributeMemo);

// Dashboard stats (admin only)
router.get('/dashboard/stats', [isAuthenticated, isAdmin], dashboardController.getDashboardStats);

// Notifications
router.get('/notifications', [isAuthenticated], notificationController.getNotifications);
router.put('/notifications/:id/read', [isAuthenticated], notificationController.markAsRead);

module.exports = router;

