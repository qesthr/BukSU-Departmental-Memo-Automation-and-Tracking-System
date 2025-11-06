const User = require('../models/User');
const { audit } = require('../middleware/auditLogger');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

// Google OAuth client for token verification
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google token login controller (handles JWT tokens from Google Identity Services)
const googleTokenLogin = async (req, res, next) => {
    try {
        console.log('🔐 Starting Google user verification...');
        const { credential, idToken, accessToken, email, name, imageUrl } = req.body;

        if (!credential && !idToken && !accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Google credential, ID token, or access token is required'
            });
        }

        let userInfo = null;

        if (credential) {
            // Handle JWT token from Google Identity Services
            try {
                const ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID
                });
                userInfo = ticket.getPayload();
            } catch (error) {
                console.error('JWT verification error:', error);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid Google credential'
                });
            }
        } else if (accessToken) {
            // Use access token to get user info
            const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`);
            if (!response.ok) {
                throw new Error('Failed to fetch user info');
            }
            userInfo = await response.json();
        } else if (idToken) {
            // Verify the Google ID token
            const ticket = await client.verifyIdToken({
                idToken: idToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            userInfo = ticket.getPayload();
        }

        const googleId = userInfo.id || userInfo['sub'];
        const verifiedEmail = userInfo.email;
        console.log(`✅ Google Account Found: ${verifiedEmail || '(no email in token)'}`);
        console.log(`🔎 Searching for user with email: ${verifiedEmail || email || '(unknown)'}`);
        const userName = userInfo.name;
        const userImage = userInfo.picture;

        // Find or create user
        let user = await User.findOne({ googleId: googleId });

        if (!user) {
            // Check if user exists by email AND is active
            user = await User.findOne({
                email: verifiedEmail,
                isActive: true
            });

            if (user) {
                console.log('✅ Found user in Users collection (active)');
                // User exists and is active - update with Google ID and preserve admin-set role/department
                user.googleId = googleId;
                user.profilePicture = userImage;
                user.lastLogin = new Date();
                await user.save();
            } else {
                console.log('❌ User not found or inactive in Users collection');
                // User doesn't exist or is inactive - admin must add them first
                return res.status(403).json({
                    success: false,
                    message: 'Your account has not been added by an administrator. Please contact your administrator to create your account.'
                });
            }
        } else {
            // Check if user is active
            if (!user.isActive) {
                console.log('❌ Authentication failed - User found but deactivated');
                return res.status(403).json({
                    success: false,
                    message: 'Your account has been deactivated. Please contact your administrator.'
                });
            }
            // Update last login and profile picture only
            user.lastLogin = new Date();
            user.profilePicture = userImage;
            await user.save();
        }

        // Log user in
        req.login(user, (err) => {
            if (err) {
                return next(err);
            }

            // Audit login success (non-blocking)
            audit(user, 'login_success', 'User Login', `User ${user.email} logged in via Google`, {
                method: 'google',
                timestamp: new Date()
            });

            console.log(`✅ Google Account ${verifiedEmail} successfully authenticated and logged in`);
            res.json({
                success: true,
                message: 'Google login successful',
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    fullName: user.fullName,
                    role: user.role,
                    department: user.department,
                    employeeId: user.employeeId,
                    profilePicture: user.profilePicture
                }
            });
        });

    } catch (error) {
        console.error('Google token login error:', error);
        // Attempt to audit failed login if email present
        try {
            if (req && req.body && req.body.email) {
                await audit({ _id: undefined, email: req.body.email }, 'login_failed', 'Login Failed', 'Google token login failed', {
                    method: 'google',
                    reason: error.message || 'invalid_token',
                    timestamp: new Date()
                });
            }
        } catch (_) { }
        console.log('❌ Authentication failed - User not authorized or invalid Google token');
        res.status(401).json({
            success: false,
            message: 'Invalid Google token'
        });
    }
};

// Login controller with enhanced brute force protection
const login = async (req, res, next) => {
    try {
        // Accept both field names for compatibility (guard against undefined body)
        const body = req.body || {};
        const { email, password, recaptchaToken, 'g-recaptcha-response': recaptchaResponse } = body;
        const token = recaptchaToken || recaptchaResponse;
        const isDevBypass = (process.env.BYPASS_RECAPTCHA === 'true') || (req.headers && req.headers['x-dev-bypass-recaptcha'] === 'true');

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Verify reCAPTCHA (skip in dev bypass mode)
        if (!isDevBypass) {
            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Please complete reCAPTCHA verification.'
                });
            }

            try {
                // Verify reCAPTCHA token with Google
                console.log('Verifying reCAPTCHA token...');

                const response = await axios({
                    method: 'POST',
                    url: 'https://www.google.com/recaptcha/api/siteverify',
                    params: {
                        secret: process.env.RECAPTCHA_SECRET,
                        response: token
                    }
                });

                console.log('reCAPTCHA verification response:', response.data);

                if (!response.data.success) {
                    console.error('reCAPTCHA verification failed:', response.data['error-codes']);
                    return res.status(400).json({
                        success: false,
                        message: 'reCAPTCHA verification failed. Please try again.'
                    });
                }

                console.log('✅ reCAPTCHA verified successfully');
            } catch (error) {
                console.error('reCAPTCHA verification error:', error.message);
                console.error('Error details:', error.response?.data);
                return res.status(500).json({
                    success: false,
                    message: 'Error verifying reCAPTCHA. Please try again.'
                });
            }
        } else {
            console.log('⚠️  reCAPTCHA verification bypassed (dev mode).');
        }

        // First check if user exists at all (regardless of active status)
        const userExists = await User.findOne({
            email: email.toLowerCase().trim()
        });

        // If user doesn't exist, they haven't been invited/added by admin
        if (!userExists) {
            return res.status(401).json({
                success: false,
                message: 'This account has not been added by an administrator. Please contact your administrator to create your account.',
                errorCode: 'ACCOUNT_NOT_FOUND'
            });
        }

        // Now check if user is active
        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            isActive: true
        });

        // If user exists but is inactive
        if (!user && userExists) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated. Please contact your administrator.',
                errorCode: 'ACCOUNT_INACTIVE'
            });
        }

        // Check if account is locked using new system
        const now = Date.now();
        if (user.lockUntil && user.lockUntil > now) {
            const lockTimeRemaining = Math.ceil((user.lockUntil - now) / (1000 * 60)); // minutes
            return res.status(423).json({
                success: false,
                message: `Account is temporarily locked due to too many failed login attempts. Please try again in ${lockTimeRemaining} minute${lockTimeRemaining === 1 ? '' : 's'}.`,
                lockTimeRemaining: lockTimeRemaining
            });
        }

        // Check if account has too many violations (permanent lockout)
        if (user.violationCount >= 5) {
            return res.status(423).json({
                success: false,
                message: 'Account has been permanently locked due to repeated security violations. Please contact administrator.',
                lockTimeRemaining: null
            });
        }

        // Check if user has a password
        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: 'This account requires Google login'
            });
        }

        // Compare password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            // Increment login attempts using new progressive system
            const newAttempts = (user.loginAttempts || 0) + 1;
            const attemptsRemaining = 5 - newAttempts;

            const updates = {
                $inc: { loginAttempts: 1 },
                $set: { lastFailedLogin: new Date() }
            };

            // Lock account after 5 attempts with progressive lockout times
            if (newAttempts >= 5) {
                const lockoutTimes = [10, 30, 60, 120, 240]; // minutes
                const violationCount = user.violationCount || 0;
                const lockoutMinutes = lockoutTimes[Math.min(violationCount, lockoutTimes.length - 1)];

                updates.$set.lockUntil = now + (lockoutMinutes * 60 * 1000);
                updates.$set.violationCount = violationCount + 1;
            }

            await user.updateOne(updates);

            let message = 'Invalid email or password';
            if (attemptsRemaining > 0) {
                message += `. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before account lockout.`;
            } else {
                const violationCount = (user.violationCount || 0) + 1;
                const lockoutTimes = [10, 30, 60, 120, 240];
                const lockoutMinutes = lockoutTimes[Math.min(violationCount, lockoutTimes.length - 1)];
                message += `. Account has been locked for ${lockoutMinutes} minutes due to too many failed attempts.`;
            }

            // Audit failed login (non-blocking)
            audit(user, 'login_failed', 'Login Failed', `Failed local login for ${user.email}`, {
                method: 'local',
                attemptsRemaining,
                violationCount: (user.violationCount || 0) + (newAttempts >= 5 ? 1 : 0),
                timestamp: new Date()
            });

            return res.status(401).json({
                success: false,
                message: message,
                attemptsRemaining: attemptsRemaining
            });
        }

        // Reset login attempts on successful login
        if (user.loginAttempts > 0 || user.lockUntil) {
            await user.updateOne({
                $unset: { loginAttempts: 1, lockUntil: 1 }
            });
        }

        // Update last login
        await User.findByIdAndUpdate(user._id, {
            lastLogin: new Date()
        });

        // Refresh user data to ensure we have the latest profilePicture and other fields
        const refreshedUser = await User.findById(user._id);
        if (!refreshedUser) {
            return res.status(500).json({
                success: false,
                message: 'Error retrieving user data'
            });
        }

        // Log user in with Passport (use refreshed user for session)
        req.login(refreshedUser, (err) => {
            if (err) {
                return next(err);
            }

            // Audit login success (non-blocking)
            audit(refreshedUser, 'login_success', 'User Login', `User ${refreshedUser.email} logged in`, {
                method: 'local',
                timestamp: new Date()
            });

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    id: refreshedUser._id,
                    email: refreshedUser.email,
                    firstName: refreshedUser.firstName,
                    lastName: refreshedUser.lastName,
                    fullName: refreshedUser.fullName,
                    role: refreshedUser.role,
                    department: refreshedUser.department,
                    employeeId: refreshedUser.employeeId,
                    profilePicture: refreshedUser.profilePicture || '/images/memofy-logo.png'
                }
            });
        });

    } catch (error) {
        console.error('Login error:', error);
        next(error);
    }
};

// Logout controller
const logout = (req, res) => {
    // Capture user before logout clears req.user
    const userBeforeLogout = req.user ? { _id: req.user._id, email: req.user.email, department: req.user.department } : null;
    req.logout((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error during logout'
            });
        }

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Error destroying session'
                });
            }

            res.clearCookie('connect.sid');
            // Audit logout using captured user (best-effort)
            try {
                if (userBeforeLogout && userBeforeLogout._id) {
                    audit(userBeforeLogout, 'logout', 'User Logout', `User ${userBeforeLogout.email} logged out`, { timestamp: new Date() });
                }
            } catch (_) { }
            res.json({
                success: true,
                message: 'Logout successful'
            });
        });
    });
};

// Get current user info
const getCurrentUser = (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                fullName: req.user.fullName,
                role: req.user.role,
                department: req.user.department,
                employeeId: req.user.employeeId,
                profilePicture: req.user.profilePicture,
                lastLogin: req.user.lastLogin
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
};

// Check authentication status
const checkAuth = (req, res) => {
    res.json({
        success: true,
        isAuthenticated: req.isAuthenticated(),
        user: req.isAuthenticated() ? {
            id: req.user._id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            fullName: req.user.fullName,
            role: req.user.role,
            department: req.user.department,
            employeeId: req.user.employeeId,
            profilePicture: req.user.profilePicture
        } : null
    });
};

// Verify reCAPTCHA token
const verifyRecaptcha = async (req, res) => {
    const { token } = req.body || {};

    if (!token) {
        return res.status(400).json({
            success: false,
            message: 'reCAPTCHA token is required'
        });
    }

    try {
        console.log('Verifying reCAPTCHA token...');

        const response = await axios({
            method: 'POST',
            url: 'https://www.google.com/recaptcha/api/siteverify',
            params: {
                secret: process.env.RECAPTCHA_SECRET,
                response: token
            }
        });

        console.log('reCAPTCHA verification response:', response.data);

        if (!response.data.success) {
            console.error('reCAPTCHA verification failed:', response.data['error-codes']);
            return res.status(400).json({
                success: false,
                message: 'reCAPTCHA verification failed',
                errors: response.data['error-codes'] || []
            });
        }

        console.log('✅ reCAPTCHA verified successfully');
        return res.json({
            success: true,
            message: 'reCAPTCHA verified'
        });

    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error verifying reCAPTCHA'
        });
    }
};

module.exports = {
    login,
    logout,
    getCurrentUser,
    checkAuth,
    googleTokenLogin,
    verifyRecaptcha
};

// Self profile update (for non-admin users)
module.exports.updateMe = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        const updates = {};
        const allowed = ['firstName', 'lastName', 'email'];
        allowed.forEach(k => { if (req.body[k] !== undefined) {updates[k] = req.body[k];} });
        const User = require('../models/User');
        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
        return res.json({ success: true, message: 'Profile updated successfully', user });
    } catch (e) {
        console.error('updateMe error:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports.uploadMyProfilePicture = async (req, res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const User = require('../models/User');
        const pictureUrl = `/uploads/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user._id, { profilePicture: pictureUrl });
        return res.json({ success: true, profilePicture: pictureUrl });
    } catch (e) {
        console.error('uploadMyProfilePicture error:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
