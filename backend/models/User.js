/* eslint-disable no-console */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    password: {
        type: String,
        required: false, // Not required - users can login with Google first
        minlength: [6, 'Password must be at least 6 characters long']
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    googleDriveRefreshToken: {
        type: String,
        sparse: true
    },
    googleDriveAccessToken: {
        type: String,
        sparse: true
    },
    googleDriveTokenExpiry: {
        type: Date
    },
    // Google OAuth tokens for Calendar and profile scopes
    googleAccessToken: {
        type: String,
        sparse: true
    },
    googleRefreshToken: {
        type: String,
        sparse: true
    },
    googleTokenExpiry: {
        type: Date
    },
    // Edit locking fields for concurrency control
    locked_by: {
        type: String,
        default: null
    },
    locked_at: {
        type: Date,
        default: null
    },
    // Separate Google Calendar OAuth (independent from login)
    calendarAccessToken: {
        type: String,
        sparse: true
    },
    calendarRefreshToken: {
        type: String,
        sparse: true
    },
    calendarTokenExpiry: {
        type: Date
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'secretary', 'faculty'],
            message: '{VALUE} is not a valid role'
        },
        default: 'faculty',
        required: [true, 'User role is required']
    },
    roleVersion: {
        type: Number,
        default: 1
    },
    roleUpdatedAt: {
        type: Date,
        default: Date.now
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters long'],
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters long'],
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    employeeId: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^[A-Za-z0-9-]+$/.test(v);
            },
            message: props => `${props.value} is not a valid employee ID!`
        }
    },
    department: {
        type: String,
        trim: true,
        required: function() {
            // Department is required only for secretary and faculty roles
            return this.role !== 'admin';
        },
        validate: {
            validator: function(v) {
                // Admins must not have a department
                if (this.role === 'admin') {
                    return !v || v.trim() === '';
                }
                // Secretary and faculty must have a department
                return v && v.trim().length > 0;
            },
            message: function() {
                if (this.role === 'admin') {
                    return 'Admins cannot belong to any department';
                }
                return 'Department is required for secretaries and faculty';
            }
        }
    },
    profilePicture: {
        type: String,
        default: '/images/memofy-logo.png'
    },
    isActive: {
        type: Boolean,
        default: true,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'disabled', 'archived'],
        default: 'active',
        index: true
    },
    inviteToken: {
        type: String,
        sparse: true,
        index: true
    },
    inviteTokenExpires: {
        type: Date
    },
    inviteTokenUsed: {
        type: Boolean,
        default: false
    },
    isTemporaryPassword: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0,
        min: [0, 'Login attempts cannot be negative']
    },
    lockUntil: {
        type: Date
    },
    violationCount: {
        type: Number,
        default: 0,
        min: [0, 'Violation count cannot be negative']
    },
    lastFailedLogin: {
        type: Date
    },
    securityFlags: {
        suspiciousActivity: {
            type: Boolean,
            default: false
        },
        requiresPasswordReset: {
            type: Boolean,
            default: false
        }
    },
    canCrossSend: {
        type: Boolean,
        default: false
    },
    resetPasswordCode: {
        type: String,
        sparse: true
    },
    resetPasswordExpires: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true // Once set, cannot be changed
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastUpdatedAt: {
        type: Date,
        default: Date.now
    },
    settings: {
        darkMode: {
            type: Boolean,
            default: false
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false
        },
        sessionTimeoutMinutes: {
            type: Number,
            enum: {
                values: [1, 5, 10, 15, 30, 60, 1440],
                message: 'Session timeout must be one of the allowed durations (minutes)'
            },
            default: 1440
        },
        notifications: {
            memoEmails: {
                type: Boolean,
                default: true
            },
            profileUpdates: {
                type: Boolean,
                default: true
            }
        }
    }
});

// Virtual for full name
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    // Only hash the password if it exists and has been modified (or is new)
    if (!this.password || !this.isModified('password')) { return next(); }

    try {
        // Hash password with cost of 12
        const hashedPassword = await bcrypt.hash(this.password, 12);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Update updatedAt field before saving
userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    this.lastUpdatedAt = new Date();

    // Ensure admins never have a department
    if (this.role === 'admin' && this.department) {
        this.department = '';
    }

    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) { return false; }
    return await bcrypt.compare(candidatePassword, this.password);
};

// Legacy brute force methods (now handled by middleware)
// These are kept for backward compatibility but not used
userSchema.methods.incLoginAttempts = function () {
    console.warn('incLoginAttempts is deprecated. Use bruteForce middleware instead.');
    return this.updateOne({ $inc: { loginAttempts: 1 } });
};

userSchema.methods.resetLoginAttempts = function () {
    console.warn('resetLoginAttempts is deprecated. Use bruteForce middleware instead.');
    return this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
    });
};

// Create indexes
// Note: email, googleId, and employeeId indexes are automatically created by unique: true
// Only explicitly index non-unique fields that need indexing
userSchema.index({ role: 1 });

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
