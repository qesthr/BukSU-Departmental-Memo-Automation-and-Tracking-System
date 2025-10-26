const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

// Google OAuth client for token verification
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google token login controller (handles JWT tokens from Google Identity Services)
const googleTokenLogin = async (req, res, next) => {
    try {
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
        const userName = userInfo.name;
        const userImage = userInfo.picture;

        // Find or create user
        let user = await User.findOne({ googleId: googleId });

        if (!user) {
            // Check if user exists by email
            user = await User.findOne({ email: verifiedEmail });

            if (user) {
                // Update existing user with Google ID
                user.googleId = googleId;
                user.profilePicture = userImage;
                await user.save();
            } else {
                // Create new user
                user = await User.create({
                    googleId: googleId,
                    email: verifiedEmail,
                    firstName: userName ? userName.split(' ')[0] : userInfo.given_name || 'Unknown',
                    lastName: userName ? userName.split(' ').slice(1).join(' ') : userInfo.family_name || 'User',
                    profilePicture: userImage,
                    role: 'faculty', // Default role for Google OAuth users
                    department: 'General', // Default department for Google OAuth users
                    lastLogin: new Date()
                });
            }
        } else {
            // Update last login and profile picture
            user.lastLogin = new Date();
            user.profilePicture = userImage;
            await user.save();
        }

        // Log user in
        req.login(user, (err) => {
            if (err) {
                return next(err);
            }

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
        res.status(401).json({
            success: false,
            message: 'Invalid Google token'
        });
    }
};

// Login controller with enhanced brute force protection
const login = async (req, res, next) => {
    try {
        // Accept both field names for compatibility
        const { email, password, recaptchaToken, 'g-recaptcha-response': recaptchaResponse } = req.body;
        const token = recaptchaToken || recaptchaResponse;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Verify reCAPTCHA
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Please complete reCAPTCHA verification.'
            });
        }

        try {
            const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${token}`;
            const { data } = await axios.post(verifyURL);

            if (!data.success) {
                return res.status(400).json({
                    success: false,
                    message: 'reCAPTCHA verification failed. Please verify that you are not a robot.'
                });
            }
        } catch (error) {
            console.error('reCAPTCHA verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error verifying reCAPTCHA. Please try again.'
            });
        }

        // Find user by email
        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            isActive: true
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
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

        // Log user in
        req.login(user, (err) => {
            if (err) {
                return next(err);
            }

            res.json({
                success: true,
                message: 'Login successful',
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
        console.error('Login error:', error);
        next(error);
    }
};

// Logout controller
const logout = (req, res) => {
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

module.exports = {
    login,
    logout,
    getCurrentUser,
    checkAuth,
    googleTokenLogin
};
