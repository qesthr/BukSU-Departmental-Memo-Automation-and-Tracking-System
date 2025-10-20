const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const createUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Define users to create - only the specified admin account
        const users = [
            {
                email: 'joenilacero20@gmail.com',
                password: 'Joenil@20',
                firstName: 'Joenil',
                lastName: 'Acero',
                role: 'admin',
                employeeId: 'ADMIN001',
                department: 'IT Department'
            }
        ];

        for (const userData of users) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });
            
            if (existingUser) {
                console.log(`User ${userData.email} already exists`);
                continue;
            }

            // Create user
            const user = new User(userData);
            await user.save();
            console.log(`✅ Created ${userData.role}: ${userData.email}`);
        }

        console.log('\n🎉 User creation completed!');
        console.log('\n📋 Admin Login Credentials:');
        console.log('Admin: joenilacero20@gmail.com / Joenil@20');

    } catch (error) {
        console.error('❌ Error creating users:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

// Run the script
createUsers();