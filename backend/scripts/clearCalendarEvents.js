const mongoose = require('mongoose');
require('dotenv').config();

const CalendarEvent = require('../models/CalendarEvent');

async function clearCalendarEvents() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}\n`);

        // Count before deletion
        const countBefore = await CalendarEvent.countDocuments();
        console.log(`📅 Current Calendar Events: ${countBefore}`);

        if (countBefore === 0) {
            console.log('✅ Calendar events collection is already empty.');
            await mongoose.disconnect();
            return;
        }

        // Delete all calendar events
        const result = await CalendarEvent.deleteMany({});
        console.log(`\n🗑️  Deleted ${result.deletedCount} calendar event(s)`);

        // Verify deletion
        const countAfter = await CalendarEvent.countDocuments();
        console.log(`\n✅ Calendar events remaining: ${countAfter}`);

        if (countAfter === 0) {
            console.log('✅ Successfully cleared all calendar events!');
        } else {
            console.log('⚠️  Warning: Some events may still exist.');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

clearCalendarEvents();

