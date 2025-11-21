// Middleware to check if user has admin role (highest role)
// This middleware is kept for backward compatibility
// For new code, use requireAdmin from rbac middleware
const rbacService = require('../services/rbacService');

const isAdmin = (req, res, next) => {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
        // For API requests, return JSON error instead of redirect
        if (req.path.startsWith('/api/') || req.accepts('json')) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }
        return res.redirect('/?error=unauthorized');
    }

    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
        // For API requests, return JSON error instead of redirect
        if (req.path.startsWith('/api/') || req.accepts('json')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid user'
            });
        }
        return res.redirect('/?error=invalid_user');
    }

        // Check if user is admin
        if (!rbacService.isAdmin(req.user)) {
            // Log unauthorized access attempt
            console.warn(`Unauthorized access attempt: User ${req.user?.email} (${req.user?.role}) tried to access admin route: ${req.path}`);

            // For API requests ONLY, return JSON error instead of redirect
            // HTML page requests should always redirect, not return JSON
            if (req.path.startsWith('/api/') && !req.accepts('html')) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized access. Admin access required.'
                });
            }

            // Redirect based on user's actual role (for HTML requests)
            const role = req.user?.role;
            const dashboardMap = {
                admin: '/admin-dashboard',
                secretary: '/dashboard',
                faculty: '/dashboard'
            };
            const redirectUrl = dashboardMap[role] || '/login';

            // Only add error message if redirecting to a different page
            // If user is already on their dashboard, don't add error (prevents showing error on legitimate dashboard access)
            const currentPath = req.path;
            const isAlreadyOnDashboard = (role === 'secretary' || role === 'faculty') && currentPath === '/dashboard';

            if (isAlreadyOnDashboard) {
                // User is already on their dashboard, just redirect without error
                return res.redirect(redirectUrl);
            }

            return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Admin access required.')}`);
        }

    // User is authenticated and is an admin
    next();
};

module.exports = isAdmin;
