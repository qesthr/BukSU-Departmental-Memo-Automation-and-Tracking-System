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
                return /^[\w-]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId; // Password required only if not using Google OAuth
        },
        minlength: [6, 'Password must be at least 6 characters long']
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
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
        required: [true, 'Department is required']
    },
    profilePicture: {
        type: String,
        default: 'default-avatar.png'
    },
    isActive: {
        type: Boolean,
        default: true,
        required: true
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
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) { return next(); }

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
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ employeeId: 1 });
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
