const mongoose = require('mongoose');
require('dotenv').config();

// Import Memo model
const Memo = require('../models/Memo');

async function clearMemos() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}\n`);

        // Count memos before deletion
        const memosCount = await Memo.countDocuments();
        console.log(`📧 Current memos count: ${memosCount}`);

        if (memosCount === 0) {
            console.log('✅ No memos to delete. Database is already empty.');
            process.exit(0);
        }

        // Confirm deletion
        console.log(`\n⚠️  WARNING: About to delete ${memosCount} memo(s) from the database.`);
        console.log('This action cannot be undone!\n');

        // Delete all memos
        const result = await Memo.deleteMany({});

        console.log(`\n✅ Successfully deleted ${result.deletedCount} memo(s)!`);
        console.log('📊 Memos collection has been refreshed (cleared).');

        // Verify deletion
        const remainingCount = await Memo.countDocuments();
        console.log(`\n📧 Remaining memos: ${remainingCount}`);

        if (remainingCount === 0) {
            console.log('✅ Memos collection is now empty.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

clearMemos();

