const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const createUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Define users to create
        const users = [
            {
                email: 'admin@buksu.edu.ph',
                password: 'admin123',
                firstName: 'System',
                lastName: 'Administrator',
                role: 'admin',
                employeeId: 'ADMIN001',
                department: 'IT Department'
            },
            {
                email: 'secretary@buksu.edu.ph',
                password: 'secretary123',
                firstName: 'Maria',
                lastName: 'Santos',
                role: 'secretary',
                employeeId: 'SEC001',
                department: 'Registrar\'s Office'
            },
            {
                email: 'faculty@buksu.edu.ph',
                password: 'faculty123',
                firstName: 'Juan',
                lastName: 'Dela Cruz',
                role: 'faculty',
                employeeId: 'FAC001',
                department: 'Computer Science Department'
            },
            {
                email: 'joenilacero20@gmail.com',
                password: 'admin123',
                firstName: 'Joenil',
                lastName: 'Acero',
                role: 'admin',
                employeeId: 'ADMIN002',
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
        console.log('\n📋 Default Login Credentials:');
        console.log('Admin: admin@buksu.edu.ph / admin123');
        console.log('Secretary: secretary@buksu.edu.ph / secretary123');
        console.log('Faculty: faculty@buksu.edu.ph / faculty123');
        console.log('Joenil Admin: joenilacero20@gmail.com / admin123');

    } catch (error) {
        console.error('❌ Error creating users:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
};

// Run the script
createUsers();