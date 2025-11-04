/*
 * Utility script: Remove departments from all admin users
 * Usage: node backend/scripts/removeAdminDepartments.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function removeAdminDepartments() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/buksu_memo';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB');

    // Find all admin users with departments
    const adminUsers = await User.find({
      role: 'admin',
      $or: [
        { department: { $exists: true, $ne: null, $ne: '' } },
        { department: { $exists: false } }
      ]
    });

    if (adminUsers.length === 0) {
      console.log('✅ No admin users with departments found.');
      return;
    }

    console.log(`Found ${adminUsers.length} admin user(s) with departments:`);
    adminUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.firstName} ${user.lastName}): "${user.department || '(empty)'}"`);
    });

    // Remove departments from all admin users - use $unset or set to empty string
    const result = await User.updateMany(
      { role: 'admin' },
      { $set: { department: '' } }
    );

    console.log(`\n✅ Successfully updated ${result.modifiedCount} admin user(s).`);

    // Verify - check for any admin with non-empty department
    const remainingAdmins = await User.find({
      role: 'admin',
      department: { $exists: true, $ne: '', $ne: null }
    });

    if (remainingAdmins.length === 0) {
      console.log('✅ Verification: All admin users now have no department assigned.');
    } else {
      console.log(`⚠️  Warning: ${remainingAdmins.length} admin user(s) still have departments assigned:`);
      remainingAdmins.forEach(user => {
        console.log(`  - ${user.email}: "${user.department}"`);
      });
    }

  } catch (err) {
    console.error('Error removing admin departments:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(()=>{});
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
removeAdminDepartments();

