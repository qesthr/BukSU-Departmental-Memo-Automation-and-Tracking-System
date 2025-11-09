const mongoose = require('mongoose');
require('dotenv').config();

// Import Memo model
const Memo = require('../models/Memo');
const User = require('../models/User');

async function checkMemos() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Check collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n=== Available Collections ===');
        collections.forEach(col => {
            console.log(`- ${col.name}`);
        });

        // Check memos collection
        const memosCount = await Memo.countDocuments();
        console.log(`\n=== Memos Collection ===`);
        console.log(`Total memos: ${memosCount}`);

        if (memosCount > 0) {
            const recentMemos = await Memo.find()
                .populate('sender', 'firstName lastName email')
                .populate('recipient', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .limit(5);

            console.log('\n=== Recent 5 Memos ===');
            recentMemos.forEach((memo, idx) => {
                console.log(`${idx + 1}. ${memo.subject}`);
                console.log(`   From: ${memo.sender?.firstName} ${memo.sender?.lastName} (${memo.sender?.email})`);
                console.log(`   To: ${memo.recipient?.firstName} ${memo.recipient?.lastName} (${memo.recipient?.email})`);
                console.log(`   Type: ${memo.activityType || 'regular memo'}`);
                console.log(`   Date: ${memo.createdAt}`);
                console.log('');
            });
        }

        // Check users
        const usersCount = await User.countDocuments();
        console.log(`\n=== Users ===`);
        console.log(`Total users: ${usersCount}`);

        const adminCount = await User.countDocuments({ role: 'admin' });
        console.log(`Admin users: ${adminCount}`);

        console.log('\n✅ MongoDB and Memo collection are properly connected!');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the check
checkMemos();

