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

        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8);

        const user = new User({
            email,
            firstName,
            lastName,
            role,
            department,
            password: tempPassword, // Will be hashed by the User model pre-save hook
            isTemporaryPassword: true
        });

        await user.save();

        // TODO: Send email with temporary password to user

        res.status(201).json({
            message: 'User created successfully',
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

        await User.findByIdAndDelete(id);
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
        const { firstName, lastName, role, department } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent changing role of last admin
        if (user.role === 'admin' && role !== 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Cannot change role of the last admin' });
            }
        }

        user.firstName = firstName;
        user.lastName = lastName;
        user.role = role;
        user.department = department;

        await user.save();

        res.json({
            message: 'User updated successfully',
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
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};
