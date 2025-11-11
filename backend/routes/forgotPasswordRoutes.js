const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Forgot Password Page
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { layout: 'layouts/ForgotPasswordLayout' });
});

// Handle Forgot Password Request
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'No account found with that email address'
            });
        }

        // Generate reset code (6 digits only)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save reset code to user
        // Ensure department exists (set default if missing)
        if (!user.department) {
            user.department = 'General';
        }
        user.resetPasswordCode = resetCode;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send email with reset code using email service
        const emailResult = await emailService.sendPasswordResetCode(email, resetCode, user);

        if (emailResult.success) {
            console.log(`Reset code email sent successfully to ${email}`);
        } else {
            console.log(`Email sending failed for ${email}. Reset code: ${resetCode}`);
        }

        res.json({
            success: true,
            message: emailResult.success ? 'Reset code sent to your email' : 'Reset code generated. Check console for code.',
            redirect: '/reset-code',
            emailSent: emailResult.success,
            resetCode: emailResult.success ? undefined : resetCode // Include code if email failed
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

// Reset Code Page
router.get('/reset-code', (req, res) => {
    res.render('reset-code', { layout: 'layouts/ForgotPasswordLayout' });
});

// Handle Reset Code Verification
router.post('/reset-code', async (req, res) => {
    try {
        const { resetCode } = req.body;

        // Find user with matching reset code
        const user = await User.findOne({
            resetPasswordCode: resetCode,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code'
            });
        }

        // Store user ID in session for password reset
        req.session.resetUserId = user._id;

        res.json({
            success: true,
            message: 'Code verified successfully',
            redirect: '/reset-password'
        });

    } catch (error) {
        console.error('Reset code verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

// Reset Password Page
router.get('/reset-password', (req, res) => {
    if (!req.session.resetUserId) {
        return res.redirect('/forgot-password');
    }
    res.render('reset-password', { layout: 'layouts/ForgotPasswordLayout' });
});

// Handle Password Reset
router.post('/reset-password', async (req, res) => {
    try {
        const { newPassword, confirmPassword } = req.body;

        if (!req.session.resetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please start over.'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Find user and update password
        const user = await User.findById(req.session.resetUserId);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update password
        // Ensure department exists (set default if missing)
        if (!user.department) {
            user.department = 'General';
        }
        user.password = newPassword;
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Clear session
        req.session.resetUserId = undefined;

        res.json({
            success: true,
            message: 'Password reset successfully',
            redirect: '/'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
});

module.exports = router;
