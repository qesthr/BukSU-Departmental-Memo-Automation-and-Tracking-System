const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const cleanupUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Keep only the specified admin account
        const adminEmail = 'joenilacero20@gmail.com';

        // Also keep the Google OAuth account if it exists
        const googleEmail = 'joenil.root@gmail.com';

        // Find all users except the admin and Google account
        const usersToDelete = await User.find({
            email: { $nin: [adminEmail, googleEmail] }
        });

        console.log(`\n🗑️  Found ${usersToDelete.length} users to delete:`);
        usersToDelete.forEach(user => {
            console.log(`   - ${user.email} (${user.role})`);
        });

        // Delete users
        const deleteResult = await User.deleteMany({
            email: { $nin: [adminEmail, googleEmail] }
        });

        console.log(`\n✅ Deleted ${deleteResult.deletedCount} users`);

        // Verify only admin remains
        const remainingUsers = await User.find({}, {
            password: 0,
            loginAttempts: 0,
            lockUntil: 0
        });

        console.log('\n📋 Remaining users in database:');
        console.log('='.repeat(50));

        if (remainingUsers.length === 0) {
            console.log('No users found in database.');
        } else {
            remainingUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.fullName}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Employee ID: ${user.employeeId || 'N/A'}`);
                console.log(`   Department: ${user.department || 'N/A'}`);
                console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
                console.log(`   Created: ${user.createdAt.toLocaleString()}`);
                console.log('-'.repeat(30));
            });

            console.log(`\nTotal remaining users: ${remainingUsers.length}`);
        }

        console.log('\n🎉 Database cleanup completed!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

// Run the script
cleanupUsers();
