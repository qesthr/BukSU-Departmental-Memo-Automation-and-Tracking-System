const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google Auth Routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: '/login',
        successRedirect: '/dashboard'  // Change this to your dashboard route
    })
);

// Logout route
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

module.exports = router;