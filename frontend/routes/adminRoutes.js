const express = require('express');
const router = express.Router();
<<<<<<< HEAD

router.get('/dashboard', (req, res) => {
    res.render('admin/dashboard', {
        admin: { name: 'Queen' },
        stats: { totalMemos: 12, pending: 3, departments: 4, users: 20, acknowledged: 9, delivered: 12 },
        logs: [
            { time: '2025-10-22 14:00', user: 'RJ Larida', action: 'Created Memo', details: 'Faculty Meeting' },
            { time: '2025-10-22 14:30', user: 'Queen', action: 'Added User', details: 'New secretary account' },
        ],
=======
const isAuthenticated = require('../../backend/middleware/isAuthenticated');
const isAdmin = require('../../backend/middleware/isAdmin');

// Admin dashboard - protected with both auth and admin role check
router.get('/admin-dashboard', [isAuthenticated, isAdmin], (req, res) => {
    res.render('admin-dashboard', {
        user: req.user,
        path: '/admin-dashboard',
        stats: {
            totalMemos: 1223,
            departments: 15,
            users: 150,
            recentMemos: [
                { title: 'Faculty Meeting Agenda', department: 'Information Technology Department', date: 'October 5, 2025', type: 'blue' },
                { title: 'Urgent: Grade Submission Deadline', department: 'Information Technology Department', date: 'October 7, 2025', type: 'orange' },
                { title: 'Holiday Schedule Update', department: 'Information Technology Department', date: 'October 24, 2025', type: 'purple' }
            ]
        }
    });
});

// User management routes
router.get('/users', [isAuthenticated, isAdmin], (req, res) => {
    res.render('admin/users', {
        user: req.user,
        path: '/admin/users'
    });
});

// Department management routes
router.get('/departments', [isAuthenticated, isAdmin], (req, res) => {
    res.render('admin/departments', {
        user: req.user,
        path: '/departments'
    });
});

// Settings routes
router.get('/settings', [isAuthenticated, isAdmin], (req, res) => {
    res.render('admin/settings', {
        user: req.user,
        path: '/settings'
    });
});

// Log routes (accessible to all authenticated users, not just admins)
router.get('/log', isAuthenticated, (req, res) => {
    res.render('admin/log', {
        user: req.user,
        path: '/log'
    });
});

// Calendar route - admin only
router.get('/calendar', [isAuthenticated, isAdmin], (req, res) => {
    res.render('admin/calendar', {
        user: req.user,
        path: '/calendar'
    });
});

// Report route - admin only
router.get('/report', [isAuthenticated, isAdmin], (req, res) => {
    res.render('admin/report', {
        user: req.user,
        path: '/report'
>>>>>>> 24a06b666f6b0504be8e4daa1ac7cad27a20491d
    });
});

module.exports = router;
