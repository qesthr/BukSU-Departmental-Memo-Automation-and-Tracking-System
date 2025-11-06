const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const User = require('../models/User');

async function resetAdminPassword() {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/buksu_memo';
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ Connected to MongoDB\n');

        // Get admin email from command line argument or use default
        const adminEmail = process.argv[2] || 'joenilacero20@gmail.com';
        const newPassword = process.argv[3] || 'Admin@123'; // Default password for testing

        // Find admin user
        const admin = await User.findOne({ email: adminEmail, role: 'admin' });

        if (!admin) {
            console.log(`❌ Admin with email "${adminEmail}" not found.\n`);
            console.log('💡 Available admins:');
            const allAdmins = await User.find({ role: 'admin' }).select('email firstName lastName');
            allAdmins.forEach(a => console.log(`   - ${a.email} (${a.firstName} ${a.lastName})`));
            return;
        }

        // Set plain password - User model's pre-save hook will hash it
        admin.password = newPassword;
        admin.isActive = true;
        admin.status = 'active';
        // Reset login attempts and lockouts
        admin.loginAttempts = 0;
        admin.lockUntil = undefined;
        admin.violationCount = 0;

        await admin.save();

        console.log('✅ Admin password reset successfully!\n');
        console.log('='.repeat(60));
        console.log(`📧 Email: ${admin.email}`);
        console.log(`👤 Name: ${admin.firstName} ${admin.lastName}`);
        console.log(`🔑 Password: ${newPassword}`);
        console.log('='.repeat(60));
        console.log('\n💡 You can now login manually with these credentials.');
        console.log('⚠️  Remember to change the password after testing!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

// Usage: node backend/scripts/resetAdminPassword.js [email] [password]
// Example: node backend/scripts/resetAdminPassword.js joenilacero20@gmail.com Admin@123
resetAdminPassword();

