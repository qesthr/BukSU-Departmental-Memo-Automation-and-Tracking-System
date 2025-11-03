/*
 * Utility script: Delete all documents in the memos collection
 * Usage: node backend/scripts/clearMemos.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Memo = require('../models/Memo');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/buksu_memo';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB');
    const res = await Memo.deleteMany({});
    console.log(`Deleted ${res.deletedCount || 0} memo(s).`);
  } catch (err) {
    console.error('Error clearing memos:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(()=>{});
  }
}

run();

