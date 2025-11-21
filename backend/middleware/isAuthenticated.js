// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }

    // If request accepts HTML (browser request), redirect to unauthorized page
    if (req.accepts('html')) {
        return res.redirect('/unauthorized?error=unauthorized&message=' + encodeURIComponent('Please log in to access this page.'));
    }

    // Otherwise return JSON (API request)
    res.status(401).json({
        success: false,
        message: 'Not authenticated'
    });
};

module.exports = isAuthenticated;
