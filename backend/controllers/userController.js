const User = require('../models/User');

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
            secretary: await User.countDocuments({ role: 'secretary' }),
            faculty: await User.countDocuments({ role: 'faculty' })
        };

        res.json({ users, stats: userStats });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
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
        const { firstName, lastName, role, department, email, profilePicture } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent changing role of last admin
        if (user.role === 'admin' && role && role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot change role of the last admin' });
            }
        }

        // Update fields if provided
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (role !== undefined) user.role = role;
        if (department !== undefined) user.department = department;
        if (email !== undefined) user.email = email;
        if (profilePicture !== undefined) user.profilePicture = profilePicture;

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
