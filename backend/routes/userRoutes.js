const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const isAdmin = require('../middleware/isAdmin');
const isAuthenticated = require('../middleware/isAuthenticated');

// Protect all routes with authentication and admin middleware
router.use(isAuthenticated);
router.use(isAdmin);

// Get all users
router.get('/', userController.getAllUsers);

// Add new user
router.post('/', userController.addUser);

// Update user
router.put('/:id', userController.updateUser);

// Delete user
router.delete('/:id', userController.deleteUser);

module.exports = router;
