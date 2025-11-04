/*
 * Utility script: List users and potential memo recipients
 * Usage: node backend/scripts/listRecipients.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/buksu_memo';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB');

    const allUsers = await User.find({}).select('_id email firstName lastName role department isActive').lean();
    const activeUsers = allUsers.filter(u => u.isActive !== false);

    const admins = activeUsers.filter(u => u.role === 'admin');
    const secretaries = activeUsers.filter(u => u.role === 'secretary');
    const faculty = activeUsers.filter(u => u.role === 'faculty');

    // Potential recipients: everyone except admins (unless explicitly targeted elsewhere)
    const recipients = activeUsers.filter(u => u.role !== 'admin');

    // Group recipients by department
    const byDept = recipients.reduce((acc, u) => {
      const key = (u.department || '').trim() || '(none)';
      acc[key] = acc[key] || [];
      acc[key].push(u);
      return acc;
    }, {});

    console.log('\nUsers summary');
    console.log(`  Total: ${allUsers.length}`);
    console.log(`  Active: ${activeUsers.length}`);
    console.log(`  Admins: ${admins.length}`);
    console.log(`  Secretaries: ${secretaries.length}`);
    console.log(`  Faculty: ${faculty.length}`);

    console.log('\nPotential recipients (non-admin), grouped by department:');
    Object.keys(byDept).sort().forEach(dept => {
      const group = byDept[dept];
      console.log(`- ${dept} (${group.length})`);
      group.forEach(u => {
        console.log(`    • ${u.firstName || ''} ${u.lastName || ''}`.trim() + ` <${u.email}> [${u.role}]`);
      });
    });

    console.log('\nNote: The app selects recipients as follows:');
    console.log(' - If specific emails are chosen, those users are targeted.');
    console.log(' - Otherwise, if a department is selected, all faculty in that department are targeted.');
    console.log(' - For secretaries with no specific selection, their own department is used by default.');
  } catch (err) {
    console.error('Error listing users/recipients:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(()=>{});
  }
}

run();


