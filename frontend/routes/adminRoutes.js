const express = require('express');
const router = express.Router();

router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', {
        admin: { name: 'Queen' },
        stats: { totalMemos: 12, pending: 3, departments: 4, users: 20, acknowledged: 9, delivered: 12 },
        logs: [
            { time: '2025-10-22 14:00', user: 'RJ Larida', action: 'Created Memo', details: 'Faculty Meeting' },
            { time: '2025-10-22 14:30', user: 'Queen', action: 'Added User', details: 'New secretary account' },
        ],
    });
});

module.exports = router;
