const express = require('express');
const router = express.Router();
const isAuthenticated = require('../../backend/middleware/isAuthenticated');
const isAdmin = require('../../backend/middleware/isAdmin');
const validateUserRole = require('../../backend/middleware/validateUserRole');

// Admin dashboard - Note: This route is handled in app.js (line 320)
// Keeping this commented out to avoid conflicts
// router.get('/admin-dashboard', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
//     res.render('admin-dashboard', {
//         user: req.user,
//         path: '/admin-dashboard',
//         stats: {
//             totalMemos: 1223,
//             departments: 15,
//             users: 150,
//             recentMemos: [
//                 { title: 'Faculty Meeting Agenda', department: 'Information Technology Department', date: 'October 5, 2025', type: 'blue' },
//                 { title: 'Urgent: Grade Submission Deadline', department: 'Information Technology Department', date: 'October 7, 2025', type: 'orange' },
//                 { title: 'Holiday Schedule Update', department: 'Information Technology Department', date: 'October 24, 2025', type: 'purple' }
//             ]
//         }
//     });
// });

// User management routes
router.get('/users', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
    res.render('admin/users', {
        user: req.user,
        path: '/admin/users'
    });
});

// Department management routes
router.get('/departments', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
    res.render('admin/departments', {
        user: req.user,
        path: '/departments'
    });
});

// Settings routes - Note: This route is handled in app.js with role-based rendering
// Keeping this for /admin/settings if needed, but main /settings is in app.js
// router.get('/settings', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
//     res.render('admin/settings', {
//         user: req.user,
//         path: '/settings'
//     });
// });

// Log routes (accessible to all authenticated users, not just admins)
router.get('/log', isAuthenticated, (req, res) => {
    res.render('admin/log', {
        user: req.user,
        path: '/log'
    });
});

// Calendar route - admin only
router.get('/calendar', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
    res.render('admin/calendar', {
        user: req.user,
        path: '/calendar'
    });
});

// Report route - admin only
router.get('/report', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
    res.render('admin/report', {
        pageTitle: 'Admin Reports | Memofy',
        user: req.user,
        path: '/report'
    });
});

// Activity Logs route - admin only
router.get('/activity-logs', [isAuthenticated, validateUserRole, isAdmin], (req, res) => {
    res.render('admin/activity-logs', {
        pageTitle: 'Admin Activity Logs | Memofy',
        user: req.user,
        path: '/admin/activity-logs'
    });
});

module.exports = router;
