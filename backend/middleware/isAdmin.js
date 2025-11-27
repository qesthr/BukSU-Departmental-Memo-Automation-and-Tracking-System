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
                secretary: '/secretary-dashboard',
                faculty: '/faculty-dashboard'
            };
            const redirectUrl = dashboardMap[role] || '/login';

            // NEVER add error parameters when redirecting to user's own dashboard
            // This prevents error popups during normal login and navigation
            const currentPath = req.path;
            const isAdminDashboard = currentPath === '/admin-dashboard' || currentPath.startsWith('/admin/');

            // Check if redirecting to user's own dashboard
            const redirectingToOwnDashboard =
                (role === 'admin' && redirectUrl === '/admin-dashboard') ||
                (role === 'secretary' && redirectUrl === '/secretary-dashboard') ||
                (role === 'faculty' && redirectUrl === '/faculty-dashboard');

            // If redirecting to user's own dashboard, NEVER add error parameters
            // This prevents false positives during login and normal navigation
            if (redirectingToOwnDashboard) {
                return res.redirect(redirectUrl);
            }

            // Only add error if they actually tried to access an admin route AND not redirecting to own dashboard
            if (isAdminDashboard) {
                return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Admin access required.')}`);
            } else {
                // Not an admin route - redirect without error
                return res.redirect(redirectUrl);
            }
        }

    // User is authenticated and is an admin
    next();
};

module.exports = isAdmin;
