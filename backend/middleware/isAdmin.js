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
            // For API requests ONLY, return JSON error instead of redirect
            // HTML page requests should always redirect, not return JSON
            if (req.path.startsWith('/api/') && !req.accepts('html')) {
                // Log unauthorized API access attempt
                console.warn(`Unauthorized access attempt: User ${req.user?.email} (${req.user?.role}) tried to access admin API route: ${req.path}`);
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

            // Check if user is trying to access their OWN dashboard (not an admin route)
            // This is normal behavior during login and navigation, not a security issue
            const accessingOwnDashboard =
                (role === 'admin' && currentPath === '/admin-dashboard') ||
                (role === 'secretary' && currentPath === '/secretary-dashboard') ||
                (role === 'faculty' && currentPath === '/faculty-dashboard');

            // If accessing their own dashboard, silently allow (this shouldn't happen here, but just in case)
            if (accessingOwnDashboard) {
                return res.redirect(redirectUrl);
            }

            // If they tried to access an admin route, check if it's from login flow
            if (isAdminDashboard) {
                // Check if request is coming from login/auth flow or if user just logged in
                const referer = req.get('referer') || '';
                const isFromLoginFlow = referer.includes('/login') ||
                                       referer.includes('/auth/') ||
                                       referer.includes('/google-callback') ||
                                       referer.includes('/auth-success');

                // Check if user just logged in (lastLogin was very recent - within last 10 seconds)
                // This helps detect login flows even if referer is missing
                const justLoggedIn = req.user?.lastLogin &&
                                    (Date.now() - new Date(req.user.lastLogin).getTime()) < 10000; // 10 seconds

                // Check if user is navigating from their own dashboard (intentional access attempt)
                const isFromOwnDashboard = referer.includes('/faculty-dashboard') ||
                                          referer.includes('/secretary-dashboard') ||
                                          referer.includes('/admin-dashboard');

                // Only log if:
                // 1. NOT from login flow AND
                // 2. NOT just logged in AND
                // 3. Either no referer (direct URL typing) OR coming from their own dashboard (intentional navigation)
                const shouldLog = !isFromLoginFlow &&
                                 !justLoggedIn &&
                                 (!referer || isFromOwnDashboard);

                if (shouldLog) {
                    console.warn(`Unauthorized access attempt: User ${req.user?.email} (${req.user?.role}) tried to access admin route: ${req.path}`);
                    return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Admin access required.')}`);
                } else {
                    // Part of login flow or just logged in - silently redirect without warning
                    return res.redirect(redirectUrl);
                }
            } else {
                // Not an admin route - redirect without error or warning (normal redirect)
                return res.redirect(redirectUrl);
            }
        }

    // User is authenticated and is an admin
    next();
};

module.exports = isAdmin;
