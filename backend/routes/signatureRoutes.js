const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');
const signatureController = require('../controllers/signatureController');
const upload = require('../middleware/upload');

// Get all signatures (admin management)
router.get('/', [isAuthenticated, isAdmin], signatureController.getAllSignatures);

// Get active signatures (for compose modal)
router.get('/active', [isAuthenticated], signatureController.getActiveSignatures);

// Create signature (admin only)
router.post('/', [isAuthenticated, isAdmin, upload.single('image')], signatureController.createSignature);

// Update signature (admin only)
router.put('/:id', [isAuthenticated, isAdmin, upload.single('image')], signatureController.updateSignature);

// Delete signature (admin only)
router.delete('/:id', [isAuthenticated, isAdmin], signatureController.deleteSignature);

module.exports = router;

