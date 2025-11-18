// Middleware to check if user has admin role (highest role)
// This middleware is kept for backward compatibility
// For new code, use requireAdmin from rbac middleware
const rbacService = require('../services/rbacService');

const isAdmin = (req, res, next) => {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
        return res.redirect('/?error=unauthorized');
    }

    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
        return res.redirect('/?error=invalid_user');
    }

    // Check if user is admin
    if (!rbacService.isAdmin(req.user)) {
        // Log unauthorized access attempt
        console.warn(`Unauthorized access attempt: User ${req.user?.email} (${req.user?.role}) tried to access admin route: ${req.path}`);

        // Redirect based on user's actual role
        const role = req.user?.role;
        const dashboardMap = {
            admin: '/admin-dashboard',
            secretary: '/dashboard',
            faculty: '/dashboard'
        };
        const redirectUrl = dashboardMap[role] || '/login';
        return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Admin access required.')}`);
    }

    // User is authenticated and is an admin
    next();
};

module.exports = isAdmin;
