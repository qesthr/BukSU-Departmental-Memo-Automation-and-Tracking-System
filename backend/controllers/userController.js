const User = require('../models/User');
const LOCK_TTL_MS = 30000; // 30 seconds
const UserLock = require('../models/UserLock');
const { audit } = require('../middleware/auditLogger');

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
        // Persist audit log with user name
        try {
            const targetUser = await User.findById(userId).select('firstName lastName email').lean();
            const targetUserName = targetUser ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email || 'Unknown User' : 'Unknown User';
            await audit(req.user, 'user_lock_acquired', 'User edit lock acquired', `Lock acquired for user ${targetUserName} (${targetUser?.email || userId})`, { targetUserId: userId, ttl_seconds: 30 });
        } catch (e) {}
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
        // Persist audit log with user name
        try {
            const targetUser = await User.findById(userId).select('firstName lastName email').lean();
            const targetUserName = targetUser ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email || 'Unknown User' : 'Unknown User';
            await audit(req.user, 'user_lock_refreshed', 'User edit lock refreshed', `Lock refreshed for user ${targetUserName} (${targetUser?.email || userId})`, { targetUserId: userId, ttl_seconds: 30 });
        } catch (e) {}
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
        // Persist audit log with user name
        try {
            const targetUser = await User.findById(userId).select('firstName lastName email').lean();
            const targetUserName = targetUser ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email || 'Unknown User' : 'Unknown User';
            await audit(req.user, 'user_lock_released', 'User edit lock released', `Lock released for user ${targetUserName} (${targetUser?.email || userId})`, { targetUserId: userId });
        } catch (e) {}
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

// OPTIMIZED: Batch endpoint to get lock states for multiple users at once
exports.getBatchLockStates = async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.json({});
        }

        // Fetch all locks for the provided user IDs in a single query
        const now = Date.now();
        const locks = await UserLock.find({
            userId: { $in: userIds },
            expiresAt: { $gt: new Date(now) }
        }).populate('lockedBy', 'firstName lastName email').lean();

        // Build result object
        const lockStates = {};
        locks.forEach(lock => {
            const remaining = Math.ceil((lock.expiresAt.getTime() - now) / 1000);
            const name = lock.lockedBy ? (lock.lockedBy.firstName + ' ' + lock.lockedBy.lastName) : undefined;
            lockStates[lock.userId.toString()] = {
                locked: true,
                lockedBy: lock.lockedBy?._id,
                locked_by_name: name,
                remaining
            };
        });

        // Set locked: false for users without active locks
        userIds.forEach(userId => {
            if (!lockStates[userId.toString()]) {
                lockStates[userId.toString()] = { locked: false };
            }
        });

        return res.json(lockStates);
    } catch (e) {
        console.error('Error fetching batch lock states:', e);
        return res.status(500).json({ message: 'Failed to get lock states' });
    }
};

// Get all users with optional filtering
exports.getAllUsers = async (req, res) => {
    try {
        const { role, includeArchived } = req.query;
        const query = {};

        // By default, only show active users unless includeArchived is true
        if (includeArchived !== 'true') {
            query.isActive = { $ne: false }; // Include active users and users without isActive set
        }

        if (role && role !== 'all') {
            query.role = role;
        }

        // OPTIMIZED: Parallelize user fetch and stats calculation
        const activeQuery = { isActive: { $ne: false } };
        const [users, userStats] = await Promise.all([
            User.find(query).select('-password -googleId').sort({ createdAt: -1 }).lean(),
            // Parallelize all count queries
            Promise.all([
                User.countDocuments(activeQuery),
                User.countDocuments({ ...activeQuery, role: 'admin' }),
                User.countDocuments({ ...activeQuery, role: 'secretary' }),
                User.countDocuments({ ...activeQuery, role: 'faculty' }),
                User.countDocuments({ isActive: false })
            ])
        ]);

        res.json({
            users,
            stats: {
                total: userStats[0],
                admin: userStats[1],
                secretary: userStats[2],
                faculty: userStats[3],
                archived: userStats[4]
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

// Get archived users
exports.getArchivedUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const query = { isActive: false };

        if (role && role !== 'all') {
            query.role = role;
        }

        // OPTIMIZED: Use lean() for faster queries (no Mongoose document overhead)
        const users = await User.find(query).select('-password -googleId').sort({ updatedAt: -1 }).lean();

        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching archived users:', error);
        res.status(500).json({ message: 'Error fetching archived users' });
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
        // Admins cannot have departments
        const userData = {
            email,
            firstName,
            lastName,
            role,
            department: role === 'admin' ? '' : department
        };

        const user = new User(userData);

        await user.save();
        // Audit create
        try { await audit(req.user, 'user_created', 'User Created', `Created user ${user.email}`, { targetUserId: user._id, role: user.role, department: user.department }); } catch (e) {}
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

// Archive user (set isActive: false instead of deleting)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-archival
        if (String(req.user._id) === String(id)) {
            return res.status(403).json({ error: 'You cannot archive your own account.' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already archived
        if (user.isActive === false) {
            return res.status(400).json({ message: 'User is already archived' });
        }

        // Prevent archiving of last active admin
        if (user.role === 'admin') {
            const activeAdminCount = await User.countDocuments({ role: 'admin', isActive: true });
            if (activeAdminCount <= 1) {
                return res.status(400).json({ message: 'Cannot archive the last active admin user' });
            }
        }

        // Archive the user (set isActive to false)
        user.isActive = false;
        user.status = 'archived';
        await user.save();

        // Audit archive
        try {
            await audit(req.user, 'user_archived', 'User Archived', `Archived user ${user.email}`, {
                targetUserId: id,
                role: user.role,
                department: user.department
            });
        } catch (e) {}

        // Log archive activity (non-blocking)
        try {
            const activityLogger = require('../services/activityLogger');
            await activityLogger.log(req.user, 'user_archived', `User ${user.email} has been archived`, {
                targetResource: 'user',
                targetId: user._id,
                targetName: `${user.firstName} ${user.lastName}`,
                metadata: {
                    archivedUserEmail: user.email,
                    archivedUserRole: user.role,
                    archivedUserDepartment: user.department
                }
            });
        } catch (logError) {
            console.error('Failed to log archive activity:', logError);
        }

        res.json({ success: true, message: 'User archived successfully' });
    } catch (error) {
        console.error('Error archiving user:', error);
        res.status(500).json({ message: 'Error archiving user' });
    }
};

// Unarchive user (set isActive: true)
exports.unarchiveUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already active
        if (user.isActive === true) {
            return res.status(400).json({ message: 'User is already active' });
        }

        // Unarchive the user (set isActive to true)
        user.isActive = true;
        user.status = 'active';
        await user.save();

        // Audit unarchive
        try {
            await audit(req.user, 'user_activated', 'User Unarchived', `Unarchived user ${user.email}`, {
                targetUserId: id,
                role: user.role,
                department: user.department
            });
        } catch (e) {}

        // Log unarchive activity (non-blocking)
        try {
            const activityLogger = require('../services/activityLogger');
            await activityLogger.log(req.user, 'user_activated', `User ${user.email} has been unarchived`, {
                targetResource: 'user',
                targetId: user._id,
                targetName: `${user.firstName} ${user.lastName}`,
                metadata: {
                    unarchivedUserEmail: user.email,
                    unarchivedUserRole: user.role,
                    unarchivedUserDepartment: user.department
                }
            });
        } catch (logError) {
            console.error('Failed to log unarchive activity:', logError);
        }

        res.json({ success: true, message: 'User unarchived successfully' });
    } catch (error) {
        console.error('Error unarchiving user:', error);
        res.status(500).json({ message: 'Error unarchiving user' });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, role, department, email, profilePicture, lastUpdatedAt, canCrossSend, canAddSignature, isActive } = req.body;

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

        // Prevent deactivating yourself
        if (String(req.user._id) === String(id) && (isActive === false)) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        // Optimize: Check admin counts in parallel only if needed (faster than sequential)
        // Use findOne with limit(2) instead of countDocuments - much faster when we only need to know if count > 1
        const needsRoleCheck = user.role === 'admin' && role && role !== 'admin';
        const needsDeactivateCheck = (isActive === false) && user.role === 'admin';
        
        if (needsRoleCheck || needsDeactivateCheck) {
            // Run checks in parallel for better performance
            const checks = await Promise.all([
                needsRoleCheck 
                    ? User.findOne({ role: 'admin', _id: { $ne: id } }).select('_id').lean().limit(1)
                    : Promise.resolve(null),
                needsDeactivateCheck
                    ? User.findOne({ role: 'admin', isActive: true, _id: { $ne: id } }).select('_id').lean().limit(1)
                    : Promise.resolve(null)
            ]);
            
            // Prevent changing role of last admin
            if (needsRoleCheck && !checks[0]) {
                return res.status(400).json({ message: 'Cannot change role of the last admin' });
            }
            
            // Prevent deactivating last admin
            if (needsDeactivateCheck && !checks[1]) {
                return res.status(400).json({ message: 'Cannot deactivate the last active admin' });
            }
        }

        // Optimize: Build update object directly and use updateOne (faster than save())
        const targetRole = role !== undefined ? role : user.role;
        const updateData = {};
        
        // Update fields if provided
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (role !== undefined) updateData.role = role;
        if (department !== undefined) updateData.department = department;
        if (email !== undefined) updateData.email = email;
        if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
        if (isActive !== undefined) {
            updateData.isActive = !!isActive;
            updateData.status = isActive ? 'active' : 'disabled';
        }

        // Handle secretary-specific permissions
        if (targetRole === 'secretary') {
            if (canCrossSend !== undefined) updateData.canCrossSend = !!canCrossSend;
            if (canAddSignature !== undefined) updateData.canAddSignature = !!canAddSignature;
        } else {
            updateData.canCrossSend = false;
            updateData.canAddSignature = false;
        }

        // Enforce: Admins are not assigned to any department
        if (targetRole === 'admin') {
            updateData.department = '';
        }

        // Use updateOne which is faster than save() for simple updates
        await User.updateOne({ _id: id }, { $set: updateData });
        
        // Update local user object for response
        Object.assign(user, updateData);
        
        // Send response immediately (non-blocking)
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
                isActive: user.isActive,
                status: user.status,
                canCrossSend: user.canCrossSend,
                profilePicture: user.profilePicture
            }
        });

        // Non-blocking operations after response is sent
        // Audit update (fire and forget)
        const targetUserName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        audit(req.user, 'user_updated', 'User Updated', `Updated user ${user.email}`, { 
            targetUserId: user._id, 
            targetName: targetUserName,
            targetUserEmail: user.email,
            fields: Object.keys(req.body || {}) 
        }).catch(e => {
            console.error('Audit error (non-blocking):', e?.message || e);
        });

        // Log to Activity Logs (fire and forget) - visible in Admin Activity Logs
        const activityLogger = require('../services/activityLogger');
        const updatedFields = Object.keys(req.body || {}).filter(k => 
            ['firstName', 'lastName', 'role', 'department', 'email', 'isActive', 'canCrossSend', 'canAddSignature'].includes(k)
        );
        activityLogger.logUserAction(req.user, 'user_updated', user, {
            description: `Updated user ${user.email}`,
            metadata: {
                updatedFields: updatedFields,
                updatedBy: req.user.email,
                targetUserEmail: user.email
            }
        }).catch(e => {
            console.error('ActivityLog error (non-blocking):', e?.message || e);
        });

        // Notify user and admin about profile edit (only if admin is editing another user's profile) - fire and forget
        if (String(req.user._id) !== String(id) && req.user.role === 'admin') {
            const notificationService = require('../services/notificationService');
            notificationService.notifyUserProfileEdited({
                editedUser: user,
                adminUser: req.user
            }).catch(e => {
                console.error('Error sending profile edit notification (non-blocking):', e?.message || e);
            });
        }
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

        const mimeType = req.file.mimetype || 'image/png';
        const base64Data = req.file.buffer?.toString('base64');

        if (!base64Data) {
            return res.status(400).json({ message: 'Invalid image data' });
        }

        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        await User.findByIdAndUpdate(id, { profilePicture: dataUrl });
        console.log(`[ProfilePicture] Admin ${req.user?.email || req.user?._id || 'unknown'} updated ${id}'s profile picture (stored ${base64Data.length} bytes in DB).`);

        res.json({
            success: true,
            message: 'Profile picture updated successfully',
            profilePicture: dataUrl
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

        // Ensure core departments always appear even if no active user is currently assigned
        const coreDepartments = [
            'Food Technology',
            'Electronics Technology',
            'Automotive Technology',
            'Information Technology and Entertainment Multimedia Computing'
        ];

        const unique = Array.from(new Set([...normalized, ...coreDepartments])).sort((a, b) => a.localeCompare(b));
        res.json({ success: true, departments: unique });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ success: false, message: 'Error fetching departments' });
    }
};
