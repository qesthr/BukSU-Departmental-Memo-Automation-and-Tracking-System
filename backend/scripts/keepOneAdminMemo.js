const mongoose = require('mongoose');
require('dotenv').config();

const Memo = require('../models/Memo');
const User = require('../models/User');

async function keepOneAdminMemo() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.name}\n`);

        // Find the admin user
        const adminEmail = 'joenilacero20@gmail.com';
        const admin = await User.findOne({ email: adminEmail.toLowerCase() });

        if (!admin) {
            console.error(`❌ Admin user not found: ${adminEmail}`);
            process.exit(1);
        }

        console.log(`👤 Found admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
        console.log(`   User ID: ${admin._id}\n`);

        // Find memos for this admin (sent or received)
        const adminMemos = await Memo.find({
            $or: [
                { sender: admin._id },
                { recipient: admin._id }
            ]
        }).sort({ createdAt: -1 });

        const totalMemos = await Memo.countDocuments();
        const adminMemoCount = adminMemos.length;

        console.log(`📧 Total memos in database: ${totalMemos}`);
        console.log(`📧 Memos for admin: ${adminMemoCount}`);

        if (adminMemoCount === 0) {
            console.log('\n⚠️  No memos found for this admin. Deleting all memos...');
            const result = await Memo.deleteMany({});
            console.log(`✅ Deleted ${result.deletedCount} memo(s)`);
        } else {
            // Keep the most recent memo for this admin
            const memoToKeep = adminMemos[0];
            console.log(`\n📌 Keeping memo: "${memoToKeep.subject}"`);
            console.log(`   Created: ${memoToKeep.createdAt}`);
            console.log(`   From: ${memoToKeep.sender?.toString() === admin._id.toString() ? 'Admin (sent)' : 'Other'}`);
            console.log(`   To: ${memoToKeep.recipient?.toString() === admin._id.toString() ? 'Admin (received)' : 'Other'}\n`);

            // Delete all memos except this one
            const deleteResult = await Memo.deleteMany({
                _id: { $ne: memoToKeep._id }
            });

            console.log(`✅ Deleted ${deleteResult.deletedCount} memo(s)`);
            console.log(`📌 Kept 1 memo for admin`);
        }

        // Verify final state
        const finalCount = await Memo.countDocuments();
        console.log(`\n📧 Final memo count: ${finalCount}`);

        if (finalCount === 1) {
            const remainingMemo = await Memo.findOne();
            console.log(`✅ Success! Only 1 memo remains: "${remainingMemo.subject}"`);
        } else {
            console.log(`⚠️  Warning: ${finalCount} memos remain (expected 1)`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

keepOneAdminMemo();
