const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const isAuthenticated = require('../middleware/isAuthenticated');

// Route to set/update password for Google OAuth users
router.post('/set-password', isAuthenticated, async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const userId = req.user._id;

        // Validate password
        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update user's password
        await User.findByIdAndUpdate(userId, {
            password: hashedPassword,
            updatedAt: Date.now()
        });

        res.json({
            success: true,
            message: 'Password set successfully'
        });

    } catch (error) {
        console.error('Set password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting password'
        });
    }
});

// Route to check if user has password set
router.get('/has-password', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('+password');
        res.json({
            success: true,
            hasPassword: !!user.password
        });
    } catch (error) {
        console.error('Check password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking password status'
        });
    }
});

module.exports = router;