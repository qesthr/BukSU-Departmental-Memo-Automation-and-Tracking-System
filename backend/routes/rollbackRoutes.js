// Rollback Routes - NEW routes for rollback functionality
// These routes are separate and don't affect existing routes

const express = require('express');
const router = express.Router();
const rollbackController = require('../controllers/rollbackController');
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');

// All rollback routes require admin authentication
router.use(isAuthenticated);
router.use(isAdmin);

// Get rollback logs
router.get('/logs', rollbackController.getRollbackLogs);

// Get specific rollback log
router.get('/logs/:id', rollbackController.getRollbackLog);

// Get available rollbacks
router.get('/available', rollbackController.getAvailableRollbacks);

// Perform manual rollback
router.post('/:id', rollbackController.rollbackOperation);

module.exports = router;

