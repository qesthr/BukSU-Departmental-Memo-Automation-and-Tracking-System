const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');

// Local authentication routes
router.post('/login', authController.login);
router.post('/verify-recaptcha', authController.verifyRecaptcha);
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

/**
 * Google OAuth Authentication Routes
 *
 * These routes handle the OAuth 2.0 flow with Google:
 * 1. /auth/google - Starts the OAuth flow, redirects user to Google
 * 2. /auth/google/callback - Google redirects here after authentication
 *
 * Flow:
 * - User clicks "Sign in with Google"
 * - Gets redirected to Google's authorization server
 * - User selects account and approves
 * - Google redirects back to /auth/google/callback with authorization code
 * - Passport.js exchanges code for user info and creates/updates user session
 * - Session is saved to database
 * - Callback page is rendered in the popup
 * - Client-side JavaScript detects popup and sends message to parent
 * - Parent window loads dashboard content dynamically
 */

// Route 1: Start Google OAuth flow
// This redirects the user to Google's authorization page
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Route 2: Handle Google OAuth callback
// Google redirects here after user approves authentication
router.get('/google/callback',
    (req, res, next) => {
        // STEP 1: Authenticate with Passport.js
        // This verifies the authorization code and creates/updates the user session
        // Passport.js handles:
        // - Verifying the authorization code with Google
        // - Fetching user profile from Google
        // - Finding existing user in database (NO AUTO-CREATION)
        // - Setting up session with user data
        passport.authenticate('google', {
            session: true  // Save session to database
        }, (err, user, info) => {
            // Handle authentication result
            if (err) {
                console.error('❌ Google OAuth error:', err);
                return res.redirect('/login?error=oauth_error');
            }

            if (!user) {
                // User doesn't exist - admin must add them first
                console.log('❌ Google OAuth failed - user not found or inactive');
                const errorMsg = info?.message || 'Account not found. Please contact your administrator.';
                return res.redirect('/login?error=account_not_found&message=' + encodeURIComponent(errorMsg));
            }

            // Login successful - update session
            req.login(user, (err) => {
                if (err) {
                    console.error('❌ Session error:', err);
                    return res.redirect('/login?error=session_error');
                }

                // Continue to render callback page
                next();
            });
        })(req, res, next);
    },
    (req, res) => {
        // STEP 2: Render the callback page
        // The callback page will:
        // - Detect if it's in a popup (via window.opener)
        // - Send a message to the parent window if in popup
        // - Close the popup automatically
        // - Or redirect normally if not in popup
        console.log('✅ Rendering google-callback page for popup');
        console.log('User authenticated:', req.user ? req.user.email : 'No user');
        res.render('google-callback');
    }
);

// Error handler for popup authentication failures
router.get('/google/error', (req, res) => {
    const isPopup = req.session.isPopup;
    if (isPopup) {
        delete req.session.isPopup;
        res.render('google-callback', { error: req.query.error || 'Authentication failed' });
    } else {
        res.redirect('/login?error=' + encodeURIComponent(req.query.error || 'Authentication failed'));
    }
});

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
