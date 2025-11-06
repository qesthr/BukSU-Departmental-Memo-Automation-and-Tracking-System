const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const User = require('../models/User');

async function listAdmins() {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/buksu_memo';
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ Connected to MongoDB\n');

        // Find all admin users
        const admins = await User.find({ role: 'admin' }).select('email firstName lastName isActive password employeeId createdAt');

        if (admins.length === 0) {
            console.log('❌ No admin users found in database.\n');
            console.log('💡 To create an admin, run: node backend/scripts/createAdmin.js');
            return;
        }

        console.log(`📋 Found ${admins.length} admin user(s):\n`);
        console.log('='.repeat(80));

        admins.forEach((admin, index) => {
            console.log(`\n${index + 1}. Admin Details:`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
            console.log(`   Employee ID: ${admin.employeeId || 'N/A'}`);
            console.log(`   Status: ${admin.isActive ? '✅ Active' : '❌ Inactive'}`);
            console.log(`   Has Password: ${admin.password ? '✅ Yes' : '❌ No (Google OAuth only)'}`);
            console.log(`   Created: ${admin.createdAt ? new Date(admin.createdAt).toLocaleString() : 'N/A'}`);

            if (admin.password) {
                console.log(`   ✅ Can login with: Email + Password (Manual Login)`);
            } else {
                console.log(`   ⚠️  Can only login with: Google OAuth`);
                console.log(`   💡 To enable manual login, invite this admin or set password via /api/password/set-password`);
            }
        });

        console.log('\n' + '='.repeat(80));
        console.log('\n💡 Note: Passwords are hashed and cannot be retrieved.');
        console.log('💡 To reset an admin password, you can:');
        console.log('   1. Invite the admin (they will set password via invitation link)');
        console.log('   2. Use the password reset functionality');
        console.log('   3. Admin can set password via /api/password/set-password endpoint\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

listAdmins();

