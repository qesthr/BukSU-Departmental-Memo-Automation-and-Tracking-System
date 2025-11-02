const User = require('../models/User');
const LOCK_TTL_MS = 30000; // 30 seconds
const UserLock = require('../models/UserLock');

exports.acquireUserLock = async (req, res) => {
    try {
        const userId = req.params.id;
        // Cleanup any expired lock for this user
        const now = Date.now();
        const existing = await UserLock.findOne({ userId });
        if (existing && existing.expiresAt && existing.expiresAt.getTime() > now) {
            if (String(existing.lockedBy) !== String(req.user._id)) {
                return res.status(423).json({ locked: true, remaining: Math.ceil((existing.expiresAt.getTime() - now) / 1000) });
            }
            // If same owner, extend
            existing.lockTime = new Date();
            existing.expiresAt = new Date(Date.now() + LOCK_TTL_MS);
            await existing.save();
            return res.json({ ok: true, ttl: 30 });
        }
        // Create or replace lock
        await UserLock.findOneAndUpdate(
            { userId },
            { lockedBy: req.user._id, lockTime: new Date(), expiresAt: new Date(Date.now() + LOCK_TTL_MS) },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        // Notify others a lock has been acquired
        try { req.app.locals.broadcastEvent && req.app.locals.broadcastEvent('lock_acquired', { userId, lockedBy: req.user._id, name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() }); } catch (e) {}
        return res.json({ ok: true, ttl: 30 });
    } catch (e) {
        return res.status(500).json({ message: 'Failed to acquire lock' });
    }
};

exports.refreshUserLock = async (req, res) => {
    try {
        const userId = req.params.id;
        const lock = await UserLock.findOne({ userId });
        if (!lock || (lock.expiresAt && lock.expiresAt.getTime() <= Date.now())) {
            return res.status(409).json({ expired: true });
        }
        if (String(lock.lockedBy) !== String(req.user._id)) {
            return res.status(423).json({ locked: true });
        }
        lock.lockTime = new Date();
        lock.expiresAt = new Date(Date.now() + LOCK_TTL_MS);
        await lock.save();
        return res.json({ ok: true, ttl: 30 });
    } catch (e) {
        return res.status(500).json({ message: 'Failed to refresh lock' });
    }
};

exports.releaseUserLock = async (req, res) => {
    try {
        const userId = req.params.id;
        const lock = await UserLock.findOne({ userId });
        if (lock && String(lock.lockedBy) !== String(req.user._id) && lock.expiresAt && lock.expiresAt.getTime() > Date.now()) {
            return res.status(423).json({ locked: true });
        }
        await UserLock.deleteOne({ userId });
        try { req.app.locals.broadcastEvent && req.app.locals.broadcastEvent('lock_released', { userId }); } catch (e) {}
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ message: 'Failed to release lock' });
    }
};

exports.lockStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const lock = await UserLock.findOne({ userId }).populate('lockedBy', 'firstName lastName email');
        if (lock && lock.expiresAt && lock.expiresAt.getTime() > Date.now()) {
            const remaining = Math.ceil((lock.expiresAt.getTime() - Date.now()) / 1000);
            const name = lock.lockedBy ? (lock.lockedBy.firstName + ' ' + lock.lockedBy.lastName) : undefined;
            return res.json({ locked: true, lockedBy: lock.lockedBy?._id, locked_by_name: name, remaining });
        }
        return res.json({ locked: false });
    } catch (e) {
        return res.status(500).json({ message: 'Failed to get lock status' });
    }
};

// Get all users with optional filtering
exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const query = {};

        if (role && role !== 'all') {
            query.role = role;
        }

        const users = await User.find(query).select('-password -googleId');

        const userStats = {
            total: await User.countDocuments(),
            admin: await User.countDocuments({ role: 'admin' }),
            secretary: await User.countDocuments({ role: 'secretary' }),
            faculty: await User.countDocuments({ role: 'faculty' })
        };

        res.json({ users, stats: userStats });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// Get single user by id
exports.getUser = async (req, res) => {
    try {
        const u = await User.findById(req.params.id).select('-password -googleId');
        if (!u) { return res.status(404).json({ message: 'User not found' }); }
        return res.json({ user: u });
    } catch (e) {
        return res.status(500).json({ message: 'Error fetching user' });
    }
};

// Add new user
exports.addUser = async (req, res) => {
    try {
        const { email, firstName, lastName, role, department } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create user without password (they'll use Google OAuth to login first time)
        const user = new User({
            email,
            firstName,
            lastName,
            role,
            department
            // No password - user will login with Google OAuth first
        });

        await user.save();
        // Release any lock and notify success
        try {
            await UserLock.deleteOne({ userId: id });
            req.app.locals.broadcastEvent && req.app.locals.broadcastEvent('edit_success', {
                userId: id,
                editorId: req.user._id,
                editorName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
                email: user.email,
                name: `${user.firstName} ${user.lastName}`
            });
            req.app.locals.broadcastEvent && req.app.locals.broadcastEvent('lock_released', { userId: id });
            // Email notify all admins except the editor
            try {
                const emailService = require('../services/emailService');
                const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, isActive: true }).select('email').lean();
                const toList = (admins || []).map(a => a.email).filter(e => e && e !== req.user.email);
                if (emailService && toList.length) {
                    const subject = `User updated: ${user.firstName} ${user.lastName}`;
                    const body = `${req.user.firstName || 'An admin'} ${req.user.lastName || ''} updated ${user.firstName} ${user.lastName}.`;
                    await Promise.allSettled(toList.map(to => emailService.sendMail({ to, subject, text: body })));
                }
            } catch (e) { /* ignore email errors */ }
        } catch (e) {}

        // Send email notification to user
        try {
            const emailService = require('../services/emailService');
            await emailService.sendWelcomeEmail(user.email, user);
            console.log(`Welcome email sent to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

        res.status(201).json({
            message: 'User created successfully. They will be assigned the department and role when they login with Google.',
            user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (String(req.user._id) === String(id)) {
            return res.status(403).json({ error: 'You cannot delete your own account.' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deletion of last admin
        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last admin user' });
            }
        }

        // Get user info before deletion
        const deletedUser = user;

        // Delete the user
        await User.findByIdAndDelete(id);

        // Create log entry for user deletion (non-blocking)
        try {
            const Memo = require('../models/Memo');
            const adminUsers = await User.find({ role: 'admin' }).select('_id');

            if (adminUsers.length > 0) {
                const logPromises = adminUsers.map(admin => {
                    return Memo.create({
                        sender: req.user._id,
                        recipient: admin._id,
                        subject: `User Account Deleted`,
                        content: `User ${deletedUser.email} (${deletedUser.firstName} ${deletedUser.lastName}) has been deleted from the system. Role: ${deletedUser.role}, Department: ${deletedUser.department || 'N/A'}`,
                        department: 'System',
                        priority: 'high',
                        status: 'sent',
                        folder: 'sent',
                        activityType: 'user_deleted',
                        metadata: {
                            deletedUserEmail: deletedUser.email,
                            deletedUserRole: deletedUser.role,
                            deletedUserDepartment: deletedUser.department
                        }
                    });
                });

                // Don't await - just fire and forget
                Promise.all(logPromises).then(() => {
                    console.log(`User deletion logged for ${deletedUser.email}`);
                }).catch(err => {
                    console.error('Failed to create deletion log:', err);
                });
            }
        } catch (logError) {
            console.error('Failed to create deletion log:', logError);
            // Don't fail the deletion if logging fails
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, role, department, email, profilePicture, lastUpdatedAt } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Optimistic locking: if client provided lastUpdatedAt, ensure it matches
        if (lastUpdatedAt) {
            const clientTs = new Date(lastUpdatedAt).getTime();
            const serverTs = new Date(user.lastUpdatedAt || user.updatedAt || 0).getTime();
            if (clientTs && serverTs && clientTs < serverTs) {
                return res.status(409).json({ conflict: true, updated_at: user.lastUpdatedAt || user.updatedAt, updated_by: user.locked_by || undefined, wait: 30 });
            }
        }

        // Prevent changing own role/permissions
        if (String(req.user._id) === String(id) && role && role !== user.role) {
            return res.status(403).json({ message: 'You cannot change your own role or permissions.' });
        }

        // Prevent changing role of last admin
        if (user.role === 'admin' && role && role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot change role of the last admin' });
            }
        }

        // Update fields if provided
        if (firstName !== undefined) {user.firstName = firstName;}
        if (lastName !== undefined) {user.lastName = lastName;}
        if (role !== undefined) {user.role = role;}
        if (department !== undefined) {user.department = department;}
        if (email !== undefined) {user.email = email;}
        if (profilePicture !== undefined) {user.profilePicture = profilePicture;}

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                _id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                department: user.department,
                profilePicture: user.profilePicture
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

// Pre-edit locking removed; optimistic concurrency only

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const profilePictureUrl = `/images/uploads/${req.file.filename}`;

        await User.findByIdAndUpdate(id, { profilePicture: profilePictureUrl });

        res.json({
            success: true,
            message: 'Profile picture updated successfully',
            profilePicture: profilePictureUrl
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Error uploading profile picture' });
    }
};

// Get distinct departments (normalized; IT + EMC combined)
// Get all registered user emails with full info (for recipient validation and display)
exports.getUserEmails = async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('email firstName lastName profilePicture role department')
            .lean();
        const userData = users.map(user => ({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName} ${user.lastName}`,
            profilePicture: user.profilePicture || '/images/memofy-logo.png',
            role: user.role,
            department: user.department
        })).filter(u => u.email);
        res.json(userData);
    } catch (error) {
        console.error('Error fetching user emails:', error);
        res.status(500).json({ message: 'Error fetching user emails' });
    }
};

exports.getDepartments = async (req, res) => {
    try {
        const raw = await User.distinct('department');
        const normalized = (raw || [])
            .filter(Boolean)
            .map(d => String(d).trim())
            .map(d => {
                const lower = d.toLowerCase();
                if (
                    lower === 'it' ||
                    lower === 'emc' ||
                    lower === 'it/emc' ||
                    lower === 'it - emc' ||
                    lower === 'it & emc' ||
                    lower.includes('information tech') && lower.includes('multimedia') ||
                    lower.includes('entertainment') && lower.includes('comput')
                ) {
                    return 'Information Technology and Entertainment Multimedia Computing';
                }
                return d;
            });
        const unique = Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
        res.json({ success: true, departments: unique });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ success: false, message: 'Error fetching departments' });
    }
};
