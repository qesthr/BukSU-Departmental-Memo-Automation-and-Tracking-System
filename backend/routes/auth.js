const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');

// Local authentication routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/current-user', authController.getCurrentUser);
router.get('/check-auth', authController.checkAuth);

// Forgot Password System Test Page
router.get('/forgot-password-system-test', (req, res) => {
    res.render('forgot-password-system-test');
});

// Google OAuth comprehensive test page
router.get('/google-oauth-test', (req, res) => {
    res.render('google-oauth-test');
});

// Google Sign-In debug test page
router.get('/gsi-debug-test', (req, res) => {
    res.render('gsi-debug-test');
});

// Google Sign-In test page
router.get('/google-signin-test', (req, res) => {
    res.render('google-signin-test');
});

// Forgot Password test page
router.get('/forgot-password-test', (req, res) => {
    res.render('forgot-password-test');
});

// Google OAuth modal test page
router.get('/google-modal-test', (req, res) => {
    res.render('google-modal-test');
});

// Google OAuth test page
router.get('/google-test', (req, res) => {
    res.render('google-test');
});

// Google OAuth debug page
router.get('/debug-google', (req, res) => {
    res.render('debug-google');
});

// Google OAuth modal routes (new implementation)
router.get('/google/modal', (req, res) => {
    // Return Google OAuth configuration for modal
    res.json({
        success: true,
        clientId: process.env.GOOGLE_CLIENT_ID,
        redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/auth/google/modal/callback`,
        scope: 'profile email'
    });
});

router.get('/google/modal/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Return user data as JSON for modal
        res.json({
            success: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                fullName: req.user.fullName,
                profilePicture: req.user.profilePicture,
                role: req.user.role
            }
        });
    }
);

// Google OAuth token verification (for modal-based login)
router.post('/google-token', authController.googleTokenLogin);

// Test route to check Google OAuth setup
router.get('/google/test', (req, res) => {
    res.json({
        success: true,
        message: 'Google OAuth route is working',
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:5000'}/auth/google/callback`
    });
});

// Google OAuth callback page (for iframe communication)
router.get('/google/callback-page', (req, res) => {
    res.render('google-callback');
});

// Google OAuth routes (legacy redirect-based)
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // After successful authentication, redirect to auth-success first
        res.redirect('/auth-success');
    }
);

// Legacy logout route (for compatibility)
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

module.exports = router;
