// Middleware factory to require one of the allowed roles
module.exports = function requireRole(...allowedRoles) {
	return function (req, res, next) {
		if (!req.isAuthenticated || !req.isAuthenticated()) {
			return res.status(401).json({ success: false, message: 'Not authenticated' });
		}
		const role = req.user && req.user.role;
		if (!role || !allowedRoles.includes(role)) {
			return res.status(403).json({ success: false, message: 'Access denied' });
		}
		next();
	};
};


