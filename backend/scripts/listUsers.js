const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../models/User');

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buksu-memo');
        console.log('✅ Connected to MongoDB\n');

        const users = await User.find({}).select('email firstName lastName role calendarAccessToken calendarRefreshToken').lean();

        console.log(`📊 Total Users: ${users.length}\n`);

        if (users.length === 0) {
            console.log('No users found in the database.');
        } else {
            users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.email}`);
                console.log(`   Name: ${user.firstName} ${user.lastName}`);
                console.log(`   Role: ${user.role || 'N/A'}`);
                console.log(`   Google Calendar Connected: ${user.calendarAccessToken || user.calendarRefreshToken ? 'Yes' : 'No'}`);
                console.log('');
            });
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listUsers();
