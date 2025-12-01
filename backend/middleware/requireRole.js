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
				secretary: '/secretary-dashboard',
				faculty: '/faculty-dashboard'
			};
			const redirectUrl = dashboardMap[role] || '/login';
			const currentPath = req.path;

			// Check if user is trying to access a dashboard that's not for their role
			const isSecretaryDashboard = currentPath === '/secretary-dashboard';
			const isFacultyDashboard = currentPath === '/faculty-dashboard';
			const isAdminRoute = currentPath === '/admin-dashboard' || currentPath.startsWith('/admin/');

			// Add error only when trying to access a dashboard for a different role
			if (isAdminRoute && (role === 'secretary' || role === 'faculty')) {
				// Secretary/Faculty trying to access admin dashboard
				return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Admin access required.')}`);
			} else if (isSecretaryDashboard && (role === 'admin' || role === 'faculty')) {
				// Admin/Faculty trying to access secretary dashboard
				return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Secretary access required.')}`);
			} else if (isFacultyDashboard && (role === 'admin' || role === 'secretary')) {
				// Admin/Secretary trying to access faculty dashboard
				return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent('Unauthorized access. Faculty access required.')}`);
			} else {
				// Not a dashboard route or other authorization issue - redirect without error
				return res.redirect(redirectUrl);
			}
		}

		next();
	};
};


