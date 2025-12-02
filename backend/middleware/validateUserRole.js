/**
 * Middleware to validate user role hasn't changed
 * Fetches fresh user data from database to ensure role is current
 * Useful for detecting role changes that occurred while user was logged in
 */
const User = require('../models/User');

async function validateUserRole(req, res, next) {
    try {
        // Skip validation if user is not authenticated
        if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
            return next();
        }

        // Fetch fresh user data from database
        const currentUser = await User.findById(req.user._id).select('role isActive roleVersion roleUpdatedAt');

        if (!currentUser) {
            req.logout((err) => {
                if (err) {console.error('Logout error:', err);}
            });
            if (req.accepts('html')) {
                return res.redirect('/?error=user_not_found');
            }
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if account is deactivated
        if (!currentUser.isActive) {
            req.logout((err) => {
                if (err) {console.error('Logout error:', err);}
            });
            if (req.accepts('html')) {
                return res.redirect('/?error=account_deactivated');
            }
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

        // Check if role changed
        if (currentUser.role !== req.user.role) {
            // Role changed - update session and redirect
            const oldRole = req.user.role;
            req.user.role = currentUser.role;
            req.user.roleVersion = currentUser.roleVersion;
            req.user.roleUpdatedAt = currentUser.roleUpdatedAt;

            // Update session
            if (req.session) {
                req.session.user = req.user;
            }

            // Log role change detection
            console.warn(`Role change detected for user ${req.user.email}: ${oldRole} -> ${currentUser.role}`);

            // Redirect to appropriate dashboard
            const dashboardMap = {
                admin: '/admin-dashboard',
                secretary: '/secretary-dashboard',
                faculty: '/faculty-dashboard'
            };

            const redirectUrl = dashboardMap[currentUser.role] || '/login';

            if (req.accepts('html')) {
                return res.redirect(`${redirectUrl}?role_changed=true&message=${encodeURIComponent('Your role has been updated. Please log in again if needed.')}`);
            }

            return res.status(403).json({
                success: false,
                message: 'User role has changed. Please refresh your session.',
                code: 'ROLE_CHANGED',
                newRole: currentUser.role,
                redirectUrl: redirectUrl
            });
        }

        // Update role version in session if it changed (for future checks)
        if (req.user.roleVersion !== currentUser.roleVersion) {
            req.user.roleVersion = currentUser.roleVersion;
            req.user.roleUpdatedAt = currentUser.roleUpdatedAt;
            if (req.session) {
                req.session.user = req.user;
            }
        }

        next();
    } catch (error) {
        console.error('Role validation error:', error);
        // Don't block request on validation error, but log it
        next();
    }
}

module.exports = validateUserRole;

