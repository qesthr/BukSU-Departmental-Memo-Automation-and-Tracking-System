const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const inviteController = require('../controllers/inviteController');
const isAdmin = require('../middleware/isAdmin');
const isAuthenticated = require('../middleware/isAuthenticated');

// Protect all routes with authentication and admin middleware
router.use(isAuthenticated);
router.get('/departments', userController.getDepartments);
router.get('/emails', userController.getUserEmails);
router.use(isAdmin);

// Get all users
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);

// Add new user
router.post('/', userController.addUser);

// Update user
router.put('/:id', userController.updateUser);

// Concurrency lock routes removed (optimistic locking only)

// Archive user (DELETE endpoint - sets isActive: false)
router.delete('/:id', userController.deleteUser);

// Unarchive user (POST endpoint - sets isActive: true)
router.post('/:id/unarchive', userController.unarchiveUser);

// Get archived users
router.get('/archived/list', userController.getArchivedUsers);

// Upload profile picture
router.post('/:id/profile-picture', userController.uploadProfilePicture);

// 2PL edit lock endpoints
router.post('/lock-user/:id', userController.acquireUserLock);
router.post('/lock-user/:id/refresh', userController.refreshUserLock);
router.post('/unlock-user/:id', userController.releaseUserLock);
router.get('/lock-status/:id', userController.lockStatus);
router.get('/locks/:id/state', userController.lockStatus);

// Invitations
router.post('/invite', inviteController.inviteUser);
router.get('/invite/:token', inviteController.renderInvitePage);
router.post('/invite/complete', inviteController.completeInvite);

module.exports = router;
