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
			// For API requests ONLY, return JSON error instead of redirect
			// HTML page requests should always redirect, not return JSON
			if (req.path.startsWith('/api/') && !req.accepts('html')) {
				// Log unauthorized API access attempt
				console.warn(`Unauthorized access attempt: User ${req.user?.email} (${role || 'unknown'}) tried to access API route requiring [${allowedRoles.join(', ')}]: ${req.path}`);
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

			// Detect what type of route they tried to access
			const isAdminRoute = currentPath === '/admin-dashboard' || currentPath.startsWith('/admin/');
			const isSecretaryRoute = currentPath === '/secretary-dashboard' || currentPath.startsWith('/secretary/');
			const isFacultyRoute = currentPath === '/faculty-dashboard' || currentPath.startsWith('/faculty/');

			// Check if request is coming from login/auth flow or if user just logged in
			const referer = req.get('referer') || '';
			const isFromLoginFlow = referer.includes('/login') ||
								   referer.includes('/auth/') ||
								   referer.includes('/google-callback') ||
								   referer.includes('/auth-success');

			// Check if user just logged in (lastLogin was very recent - within last 10 seconds)
			const justLoggedIn = req.user?.lastLogin &&
								(Date.now() - new Date(req.user.lastLogin).getTime()) < 10000; // 10 seconds

			// Check if user is navigating from their own dashboard (intentional access attempt)
			const isFromOwnDashboard = referer.includes('/faculty-dashboard') ||
									  referer.includes('/secretary-dashboard') ||
									  referer.includes('/admin-dashboard');

			// Only log if:
			// 1. NOT from login flow AND
			// 2. NOT just logged in AND
			// 3. Either no referer (direct URL typing) OR coming from their own dashboard
			const shouldLog = !isFromLoginFlow &&
							 !justLoggedIn &&
							 (!referer || isFromOwnDashboard);

			// Determine error message based on route type
			let errorMessage = 'Unauthorized access. You do not have permission to access this page.';
			if (isAdminRoute) {
				errorMessage = 'Unauthorized access. Admin access required.';
			} else if (isSecretaryRoute) {
				errorMessage = 'Unauthorized access. Secretary access required.';
			} else if (isFacultyRoute) {
				errorMessage = 'Unauthorized access. Faculty access required.';
			}

			// Log unauthorized access attempt if it's a real attempt (not login flow)
			if (shouldLog) {
				console.warn(`Unauthorized access attempt: User ${req.user?.email} (${role || 'unknown'}) tried to access route requiring [${allowedRoles.join(', ')}]: ${req.path}`);
				// Redirect with error parameters to show SweetAlert
				return res.redirect(`${redirectUrl}?error=unauthorized_access&message=${encodeURIComponent(errorMessage)}`);
			} else {
				// Part of login flow or just logged in - silently redirect without warning
				return res.redirect(redirectUrl);
			}
		}

		next();
	};
};


