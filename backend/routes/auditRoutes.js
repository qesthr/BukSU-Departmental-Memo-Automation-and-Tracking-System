const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const isAuthenticated = require('../middleware/isAuthenticated');

router.use(isAuthenticated);

router.get('/logs', auditController.getLogs);
router.get('/logs/:id', auditController.getLogById);
router.delete('/logs/:id', auditController.deleteLog);

module.exports = router;


