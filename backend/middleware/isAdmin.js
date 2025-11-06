// Middleware to check if user has admin role
const isAdmin = (req, res, next) => {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
        return res.redirect('/?error=unauthorized');
    }

    // Check if user exists and has a role
    if (!req.user || !req.user.role) {
        return res.redirect('/?error=invalid_user');
    }

    // Strictly check for 'admin' role only
    if (req.user.role !== 'admin') {
        return res.redirect('/dashboard?error=access_denied');
    }

    // User is authenticated and is an admin
    next();
};

module.exports = isAdmin;
