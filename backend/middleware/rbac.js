const rbacService = require('../services/rbacService');

/**
 * RBAC Middleware
 *
 * Middleware for checking permissions using Role-Based Access Control
 */

/**
 * Middleware factory to require a specific permission
 * @param {string} permission - Permission to check
 * @param {Object} options - Options for the middleware
 * @returns {Function} Express middleware function
 */
function requirePermission(permission, options = {}) {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.isAuthenticated || !req.isAuthenticated()) {
                if (options.redirect) {
                    return res.redirect('/?error=unauthorized');
                }
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }

            // Check if user exists
            if (!req.user) {
                if (options.redirect) {
                    return res.redirect('/?error=invalid_user');
                }
                return res.status(401).json({
                    success: false,
                    message: 'Invalid user'
                });
            }

            // Check permission
            const hasPermission = await rbacService.can(req.user, permission);

            if (!hasPermission) {
                if (options.redirect) {
                    // Redirect to role-based dashboard
                    const role = req.user?.role;
                    const dashboardMap = {
                        admin: '/admin-dashboard',
                        secretary: '/secretary-dashboard',
                        faculty: '/faculty-dashboard'
                    };
                    const redirectUrl = dashboardMap[role] || '/login';
                    return res.redirect(`${redirectUrl}?error=access_denied`);
                }
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error('RBAC middleware error:', error);
            if (options.redirect) {
                // Redirect to role-based dashboard
                const role = req.user?.role;
                const dashboardMap = {
                    admin: '/admin-dashboard',
                    secretary: '/secretary-dashboard',
                    faculty: '/faculty-dashboard'
                };
                const redirectUrl = dashboardMap[role] || '/login';
                return res.redirect(`${redirectUrl}?error=server_error`);
            }
            return res.status(500).json({
                success: false,
                message: 'Error checking permissions'
            });
        }
    };
}

/**
 * Middleware factory to require any of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @param {Object} options - Options for the middleware
 * @returns {Function} Express middleware function
 */
function requireAnyPermission(permissions, options = {}) {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.isAuthenticated || !req.isAuthenticated()) {
                if (options.redirect) {
                    return res.redirect('/?error=unauthorized');
                }
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }

            // Check if user exists
            if (!req.user) {
                if (options.redirect) {
                    return res.redirect('/?error=invalid_user');
                }
                return res.status(401).json({
                    success: false,
                    message: 'Invalid user'
                });
            }

            // Check if user has any of the permissions
            const hasPermission = await rbacService.canAny(req.user, permissions);

            if (!hasPermission) {
                if (options.redirect) {
                    // Redirect to role-based dashboard
                    const role = req.user?.role;
                    const dashboardMap = {
                        admin: '/admin-dashboard',
                        secretary: '/secretary-dashboard',
                        faculty: '/faculty-dashboard'
                    };
                    const redirectUrl = dashboardMap[role] || '/login';
                    return res.redirect(`${redirectUrl}?error=access_denied`);
                }
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error('RBAC middleware error:', error);
            if (options.redirect) {
                // Redirect to role-based dashboard
                const role = req.user?.role;
                const dashboardMap = {
                    admin: '/admin-dashboard',
                    secretary: '/secretary-dashboard',
                    faculty: '/faculty-dashboard'
                };
                const redirectUrl = dashboardMap[role] || '/login';
                return res.redirect(`${redirectUrl}?error=server_error`);
            }
            return res.status(500).json({
                success: false,
                message: 'Error checking permissions'
            });
        }
    };
}

/**
 * Middleware factory to require all of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @param {Object} options - Options for the middleware
 * @returns {Function} Express middleware function
 */
function requireAllPermissions(permissions, options = {}) {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.isAuthenticated || !req.isAuthenticated()) {
                if (options.redirect) {
                    return res.redirect('/?error=unauthorized');
                }
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }

            // Check if user exists
            if (!req.user) {
                if (options.redirect) {
                    return res.redirect('/?error=invalid_user');
                }
                return res.status(401).json({
                    success: false,
                    message: 'Invalid user'
                });
            }

            // Check if user has all permissions
            const hasPermission = await rbacService.canAll(req.user, permissions);

            if (!hasPermission) {
                if (options.redirect) {
                    // Redirect to role-based dashboard
                    const role = req.user?.role;
                    const dashboardMap = {
                        admin: '/admin-dashboard',
                        secretary: '/secretary-dashboard',
                        faculty: '/faculty-dashboard'
                    };
                    const redirectUrl = dashboardMap[role] || '/login';
                    return res.redirect(`${redirectUrl}?error=access_denied`);
                }
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: Insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error('RBAC middleware error:', error);
            if (options.redirect) {
                // Redirect to role-based dashboard
                const role = req.user?.role;
                const dashboardMap = {
                    admin: '/admin-dashboard',
                    secretary: '/secretary-dashboard',
                    faculty: '/faculty-dashboard'
                };
                const redirectUrl = dashboardMap[role] || '/login';
                return res.redirect(`${redirectUrl}?error=server_error`);
            }
            return res.status(500).json({
                success: false,
                message: 'Error checking permissions'
            });
        }
    };
}

/**
 * Middleware to require admin role (highest role)
 * @param {Object} options - Options for the middleware
 * @returns {Function} Express middleware function
 */
function requireAdmin(options = {}) {
    return (req, res, next) => {
        // Check if user is authenticated
        if (!req.isAuthenticated || !req.isAuthenticated()) {
            if (options.redirect) {
                return res.redirect('/?error=unauthorized');
            }
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Check if user is admin
        if (!rbacService.isAdmin(req.user)) {
            // Log unauthorized access attempt
            console.warn(`Unauthorized access attempt: User ${req.user?.email} (${req.user?.role}) tried to access admin route: ${req.path}`);

            if (options.redirect) {
                // Redirect based on user's actual role
                const role = req.user?.role;
                const dashboardMap = {
                    admin: '/admin-dashboard',
                    secretary: '/secretary-dashboard',
                    faculty: '/faculty-dashboard'
                };
                const redirectUrl = dashboardMap[role] || '/login';
                return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Admin access required.')}`);
            }
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access. Admin access required.',
                code: 'UNAUTHORIZED_ACCESS'
            });
        }

        next();
    };
}

/**
 * Middleware to require superadmin role (DEPRECATED - use requireAdmin instead)
 * Kept for backward compatibility, but now requires admin role
 * @param {Object} options - Options for the middleware
 * @returns {Function} Express middleware function
 * @deprecated Use requireAdmin instead
 */
function requireSuperAdmin(options = {}) {
    // Delegate to requireAdmin since admin is now the highest role
    return requireAdmin(options);
}

module.exports = {
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireSuperAdmin,
    requireAdmin
};

