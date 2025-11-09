const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const Memo = require('../models/Memo');
const User = require('../models/User');
const UserLock = require('../models/UserLock');
const CalendarEvent = require('../models/CalendarEvent');
const SystemSetting = require('../models/SystemSetting');

async function checkDatabase() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}\n`);

        // Get all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('=== 📁 Available Collections ===');
        collections.forEach(col => {
            console.log(`  - ${col.name}`);
        });
        console.log('');

        // Check Users collection
        const usersCount = await User.countDocuments();
        console.log(`=== 👥 Users Collection ===`);
        console.log(`Total users: ${usersCount}\n`);

        if (usersCount > 0) {
            const users = await User.find()
                .select('firstName lastName email role department isActive createdAt')
                .sort({ createdAt: -1 })
                .limit(10);

            console.log('Recent 10 Users:');
            users.forEach((user, idx) => {
                console.log(`  ${idx + 1}. ${user.firstName} ${user.lastName}`);
                console.log(`     Email: ${user.email}`);
                console.log(`     Role: ${user.role || 'N/A'}`);
                console.log(`     Department: ${user.department || 'N/A'}`);
                console.log(`     Active: ${user.isActive !== false ? 'Yes' : 'No'}`);
                console.log(`     Created: ${user.createdAt}`);
                console.log('');
            });
        }

        // Check Memos collection
        const memosCount = await Memo.countDocuments();
        console.log(`=== 📧 Memos Collection ===`);
        console.log(`Total memos: ${memosCount}\n`);

        if (memosCount > 0) {
            const memos = await Memo.find()
                .populate('sender', 'firstName lastName email')
                .populate('recipient', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .limit(10);

            console.log('Recent 10 Memos:');
            memos.forEach((memo, idx) => {
                console.log(`  ${idx + 1}. ${memo.subject || '(No subject)'}`);
                console.log(`     From: ${memo.sender?.firstName || 'N/A'} ${memo.sender?.lastName || ''} (${memo.sender?.email || 'N/A'})`);
                console.log(`     To: ${memo.recipient?.firstName || 'N/A'} ${memo.recipient?.lastName || ''} (${memo.recipient?.email || 'N/A'})`);
                console.log(`     Type: ${memo.activityType || 'regular memo'}`);
                console.log(`     Status: ${memo.status || 'N/A'}`);
                console.log(`     Has Content: ${memo.content ? 'Yes (' + memo.content.length + ' chars)' : 'No'}`);
                console.log(`     Attachments: ${memo.attachments?.length || 0}`);
                console.log(`     Date: ${memo.createdAt}`);
                console.log('');
            });
        }

        // Check Calendar Events
        const eventsCount = await CalendarEvent.countDocuments();
        console.log(`=== 📅 Calendar Events Collection ===`);
        console.log(`Total events: ${eventsCount}\n`);

        if (eventsCount > 0) {
            const events = await CalendarEvent.find()
                .populate('createdBy', 'firstName lastName email')
                .sort({ startDate: -1 })
                .limit(5);

            console.log('Recent 5 Events:');
            events.forEach((event, idx) => {
                console.log(`  ${idx + 1}. ${event.title || '(No title)'}`);
                console.log(`     Start: ${event.startDate}`);
                console.log(`     End: ${event.endDate}`);
                console.log(`     Created by: ${event.createdBy?.firstName || 'N/A'} ${event.createdBy?.lastName || ''}`);
                console.log('');
            });
        }

        // Check User Locks
        const locksCount = await UserLock.countDocuments();
        console.log(`=== 🔒 User Locks Collection ===`);
        console.log(`Total locks: ${locksCount}\n`);

        // Check System Settings
        const settingsCount = await SystemSetting.countDocuments();
        console.log(`=== ⚙️ System Settings Collection ===`);
        console.log(`Total settings: ${settingsCount}\n`);

        if (settingsCount > 0) {
            const settings = await SystemSetting.find();
            settings.forEach((setting, idx) => {
                console.log(`  ${idx + 1}. ${setting.key}: ${setting.value}`);
            });
            console.log('');
        }

        // Summary
        console.log('\n=== 📊 Summary ===');
        console.log(`Collections: ${collections.length}`);
        console.log(`Users: ${usersCount}`);
        console.log(`Memos: ${memosCount}`);
        console.log(`Calendar Events: ${eventsCount}`);
        console.log(`User Locks: ${locksCount}`);
        console.log(`System Settings: ${settingsCount}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

checkDatabase();

