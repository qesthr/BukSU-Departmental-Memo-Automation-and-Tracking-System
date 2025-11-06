const User = require('../models/User');

// Progressive lockout times (in minutes)
const LOCKOUT_TIMES = [10, 30, 60, 120, 240]; // 10min, 30min, 1hr, 2hr, 4hr
const MAX_ATTEMPTS = 5;
const MAX_VIOLATIONS = 5; // Maximum violations before permanent lockout

// IP-based tracking for additional protection
const ipAttempts = new Map();
const IP_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const MAX_IP_ATTEMPTS = 10; // 10 attempts per IP

/**
 * Get client IP address
 */
function getClientIP(req) {
    return req.ip ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           '127.0.0.1';
}

/**
 * Check IP-based rate limiting
 */
function checkIPRateLimit(ip) {
    const now = Date.now();
    const ipData = ipAttempts.get(ip) || { attempts: 0, firstAttempt: now, lockUntil: null };

    // Reset if lockout expired
    if (ipData.lockUntil && ipData.lockUntil < now) {
        ipData.attempts = 0;
        ipData.lockUntil = null;
        ipData.firstAttempt = now;
    }

    // Check if IP is locked
    if (ipData.lockUntil && ipData.lockUntil > now) {
        return {
            isLocked: true,
            lockTimeRemaining: Math.ceil((ipData.lockUntil - now) / (1000 * 60))
        };
    }

    // Check if too many attempts in short time
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    if (now - ipData.firstAttempt < timeWindow && ipData.attempts >= MAX_IP_ATTEMPTS) {
        ipData.lockUntil = now + IP_LOCKOUT_TIME;
        ipAttempts.set(ip, ipData);
        return {
            isLocked: true,
            lockTimeRemaining: Math.ceil(IP_LOCKOUT_TIME / (1000 * 60))
        };
    }

    return { isLocked: false };
}

/**
 * Increment IP attempt counter
 */
function incrementIPAttempts(ip) {
    const now = Date.now();
    const ipData = ipAttempts.get(ip) || { attempts: 0, firstAttempt: now, lockUntil: null };

    ipData.attempts++;
    if (ipData.attempts === 1) {
        ipData.firstAttempt = now;
    }

    ipAttempts.set(ip, ipData);
}

/**
 * Reset IP attempt counter
 */
function resetIPAttempts(ip) {
    ipAttempts.delete(ip);
}

/**
 * Get lockout time based on violation count
 */
function getLockoutTime(violationCount) {
    const index = Math.min(violationCount, LOCKOUT_TIMES.length - 1);
    return LOCKOUT_TIMES[index] * 60 * 1000; // Convert to milliseconds
}

/**
 * Check if user account is locked due to brute force attempts
 */
async function checkAccountLockout(user) {
    const now = Date.now();

    // Check if account is currently locked
    if (user.lockUntil && user.lockUntil > now) {
        const lockTimeRemaining = Math.ceil((user.lockUntil - now) / (1000 * 60));
        return {
            isLocked: true,
            lockTimeRemaining,
            message: `Account is temporarily locked due to too many failed login attempts. Please try again in ${lockTimeRemaining} minute${lockTimeRemaining === 1 ? '' : 's'}.`
        };
    }

    // Check if account has too many violations (permanent lockout)
    if (user.violationCount >= MAX_VIOLATIONS) {
        return {
            isLocked: true,
            lockTimeRemaining: null,
            message: 'Account has been permanently locked due to repeated security violations. Please contact administrator.'
        };
    }

    return { isLocked: false };
}

/**
 * Increment user login attempts and handle lockout
 */
async function incrementUserAttempts(user) {
    const now = Date.now();

    // If we have a previous lock that has expired, restart at 1
    if (user.lockUntil && user.lockUntil < now) {
        await user.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
        return { attemptsRemaining: MAX_ATTEMPTS - 1 };
    }

    const newAttempts = (user.loginAttempts || 0) + 1;
    const attemptsRemaining = MAX_ATTEMPTS - newAttempts;

    const updates = {
        $inc: { loginAttempts: 1 }
    };

    // Lock account after max attempts
    if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = getLockoutTime(user.violationCount || 0);
        updates.$set = {
            lockUntil: now + lockoutTime,
            violationCount: (user.violationCount || 0) + 1
        };
    }

    await user.updateOne(updates);

    return { attemptsRemaining };
}

/**
 * Reset user login attempts on successful login
 */
async function resetUserAttempts(user) {
    if (user.loginAttempts > 0 || user.lockUntil) {
        await user.updateOne({
            $unset: { loginAttempts: 1, lockUntil: 1 }
        });
    }
}

/**
 * Main brute force protection middleware
 */
const bruteForceProtection = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const ip = getClientIP(req);

        // Check IP-based rate limiting first
        const ipCheck = checkIPRateLimit(ip);
        if (ipCheck.isLocked) {
            return res.status(429).json({
                success: false,
                message: `Too many login attempts from this IP. Please try again in ${ipCheck.lockTimeRemaining} minutes.`,
                type: 'ip_locked',
                lockTimeRemaining: ipCheck.lockTimeRemaining
            });
        }

        // Find user by email
        const user = await User.findOne({
            email: email?.toLowerCase()?.trim(),
            isActive: true
        });

        if (!user) {
            // Increment IP attempts even for non-existent users
            incrementIPAttempts(ip);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check account lockout
        const accountCheck = await checkAccountLockout(user);
        if (accountCheck.isLocked) {
            return res.status(423).json({
                success: false,
                message: accountCheck.message,
                type: 'account_locked',
                lockTimeRemaining: accountCheck.lockTimeRemaining
            });
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            // Increment both IP and user attempts
            incrementIPAttempts(ip);
            const attemptResult = await incrementUserAttempts(user);

            let message = 'Invalid email or password';
            if (attemptResult.attemptsRemaining > 0) {
                message += `. ${attemptResult.attemptsRemaining} attempt${attemptResult.attemptsRemaining === 1 ? '' : 's'} remaining before account lockout.`;
            } else {
                const violationCount = (user.violationCount || 0) + 1;
                const lockoutMinutes = LOCKOUT_TIMES[Math.min(violationCount, LOCKOUT_TIMES.length - 1)];
                message += `. Account has been locked for ${lockoutMinutes} minutes due to too many failed attempts.`;
            }

            return res.status(401).json({
                success: false,
                message: message,
                attemptsRemaining: attemptResult.attemptsRemaining
            });
        }

        // Successful login - reset attempts
        resetIPAttempts(ip);
        await resetUserAttempts(user);

        // Update last login
        await User.findByIdAndUpdate(user._id, {
            lastLogin: new Date()
        });

        // Log user in with Passport
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
        console.error('Brute force protection error:', error);
        next(error);
    }
};

/**
 * Admin unlock function for locked accounts
 */
const unlockAccount = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        await user.updateOne({
            $unset: { loginAttempts: 1, lockUntil: 1 },
            $set: { violationCount: 0 }
        });

        return { success: true, message: 'Account unlocked successfully' };
    } catch (error) {
        console.error('Unlock account error:', error);
        throw error;
    }
};

/**
 * Get security statistics
 */
const getSecurityStats = () => {
    const now = Date.now();
    let activeIPBlocks = 0;
    let totalIPAttempts = 0;

    for (const [ip, data] of ipAttempts.entries()) {
        totalIPAttempts += data.attempts;
        if (data.lockUntil && data.lockUntil > now) {
            activeIPBlocks++;
        }
    }

    return {
        activeIPBlocks,
        totalIPAttempts,
        maxAttempts: MAX_ATTEMPTS,
        lockoutTimes: LOCKOUT_TIMES,
        maxViolations: MAX_VIOLATIONS
    };
};

module.exports = {
    bruteForceProtection,
    unlockAccount,
    getSecurityStats,
    checkIPRateLimit,
    checkAccountLockout
};
