const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');

// Local authentication routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/current-user', authController.getCurrentUser);
router.get('/check-auth', authController.checkAuth);

// Google OAuth routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // After successful authentication, check if user needs password setup
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