const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const listUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Get all users
        const users = await User.find({}, {
            password: 0,
            loginAttempts: 0,
            lockUntil: 0
        }).sort({ createdAt: -1 });

        console.log('\n📋 Users in Database:');
        console.log('='.repeat(80));

        if (users.length === 0) {
            console.log('No users found in database.');
        } else {
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.fullName}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Employee ID: ${user.employeeId || 'N/A'}`);
                console.log(`   Department: ${user.department || 'N/A'}`);
                console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
                console.log(`   Last Login: ${user.lastLogin ? user.lastLogin.toLocaleString() : 'Never'}`);
                console.log(`   Created: ${user.createdAt.toLocaleString()}`);
                console.log('-'.repeat(40));
            });

            console.log(`\nTotal users: ${users.length}`);
        }

    } catch (error) {
        console.error('❌ Error listing users:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

// Run the script
listUsers();
