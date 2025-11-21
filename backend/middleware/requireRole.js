/**
 * Middleware factory to require one of the allowed roles
 * Enhanced with proper error handling and logging
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */
module.exports = function requireRole(...allowedRoles) {
	return function (req, res, next) {
		// Check authentication
		if (!req.isAuthenticated || !req.isAuthenticated()) {
			if (req.accepts('html')) {
				return res.redirect('/unauthorized?error=unauthorized&message=' + encodeURIComponent('Please log in to access this page.'));
			}
			return res.status(401).json({
				success: false,
				message: 'Not authenticated'
			});
		}

		const role = req.user && req.user.role;

		// Check if user has required role
		if (!role || !allowedRoles.includes(role)) {
			// Log unauthorized access attempt
			console.warn(`Unauthorized access attempt: User ${req.user?.email} (${role || 'unknown'}) tried to access route requiring [${allowedRoles.join(', ')}]: ${req.path}`);

			// For API requests ONLY, return JSON error instead of redirect
			// HTML page requests should always redirect, not return JSON
			if (req.path.startsWith('/api/') && !req.accepts('html')) {
				return res.status(403).json({
					success: false,
					message: 'Unauthorized access. You do not have permission to access this resource.',
					code: 'UNAUTHORIZED_ACCESS',
					requiredRoles: allowedRoles,
					userRole: role
				});
			}

			// Redirect based on user's actual role (for HTML requests)
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

			return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. You do not have permission to access this page.')}`);
		}

		next();
	};
};


