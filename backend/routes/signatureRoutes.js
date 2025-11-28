const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const isAdmin = require('../middleware/isAdmin');
const signatureController = require('../controllers/signatureController');
const upload = require('../middleware/upload');

// Get all signatures (admin management) - supports ?includeArchived=true query param
router.get('/', [isAuthenticated, isAdmin], signatureController.getAllSignatures);

// Get archived signatures only
router.get('/archived', [isAuthenticated, isAdmin], signatureController.getArchivedSignatures);

// Get active signatures (for compose modal)
router.get('/active', [isAuthenticated], signatureController.getActiveSignatures);

// Create signature (admin only) - use memory storage for base64 conversion
router.post('/', [isAuthenticated, isAdmin, upload.memory.single('image')], signatureController.createSignature);

// Update signature (admin only) - use memory storage for base64 conversion
router.put('/:id', [isAuthenticated, isAdmin, upload.memory.single('image')], signatureController.updateSignature);

// Archive signature (admin only) - uses DELETE method but archives instead of deleting
router.delete('/:id', [isAuthenticated, isAdmin], signatureController.deleteSignature);

// Unarchive signature (admin only)
router.post('/:id/unarchive', [isAuthenticated, isAdmin], signatureController.unarchiveSignature);

module.exports = router;

