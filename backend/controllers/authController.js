const User = require('../models/User');

// Login controller
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
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

        // Check if account is locked
        if (user.isLocked) {
            return res.status(423).json({
                success: false,
                message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
            });
        }

        // Check if user has a password (not Google OAuth only)
        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: 'Please use Google login for this account'
            });
        }

        // Compare password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            // Increment login attempts
            await user.incLoginAttempts();
            
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Reset login attempts on successful login
        if (user.loginAttempts > 0) {
            await user.resetLoginAttempts();
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
    checkAuth
};
