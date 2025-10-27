/**
 * Diagnostic script to check Google Drive integration status
 * Run: node backend/scripts/checkDriveStatus.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SystemSetting = require('../models/SystemSetting');
const connectDB = require('../config/db');

async function checkDriveStatus() {
    try {
        console.log('🔍 Checking Google Drive Integration Status...\n');

        // Connect to database
        await connectDB();

        // Check environment variables
        console.log('1. Environment Variables:');
        console.log('   GOOGLE_DRIVE_CLIENT_ID:', process.env.GOOGLE_DRIVE_CLIENT_ID ? '✓ Set' : '✗ Missing');
        console.log('   GOOGLE_DRIVE_CLIENT_SECRET:', process.env.GOOGLE_DRIVE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
        console.log('   GOOGLE_DRIVE_REDIRECT_URI:', process.env.GOOGLE_DRIVE_REDIRECT_URI || 'Not set');
        console.log('   GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID || 'Not set (will use folder from SystemSetting)');
        console.log('');

        // Check system settings
        console.log('2. System Settings:');

        const refreshToken = await SystemSetting.get('google_drive_refresh_token');
        console.log('   Google Drive Connected:', refreshToken ? '✓ YES' : '✗ NO');

        if (refreshToken) {
            console.log('   Refresh Token: Set');

            const accessToken = await SystemSetting.get('google_drive_access_token');
            const tokenExpiry = await SystemSetting.get('google_drive_token_expiry');
            console.log('   Access Token:', accessToken ? 'Set' : 'Not set');
            console.log('   Token Expiry:', tokenExpiry ? new Date(tokenExpiry).toLocaleString() : 'Not set');

            const folderId = await SystemSetting.get('google_drive_folder_id');
            console.log('   Folder ID:', folderId || 'Not set (will be created on first upload)');

            if (process.env.GOOGLE_DRIVE_FOLDER_ID && !folderId) {
                console.log('\n   ⚠️  Note: You have GOOGLE_DRIVE_FOLDER_ID in .env.');
                console.log('      Add it via API: POST /api/drive/folder with body: { "folderId": "YOUR_FOLDER_ID" }');
            }
        } else {
            console.log('\n   ✗ Google Drive is NOT connected!');
            console.log('   To connect:');
            console.log('   1. Make sure environment variables are set in .env');
            console.log('   2. As an admin, visit: http://localhost:5000/api/drive/authorize');
            console.log('   3. Complete the OAuth flow');
        }

        console.log('\n3. Status:');

        if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
            console.log('   ⚠️  Missing Google Drive credentials in .env');
        } else if (!refreshToken) {
            console.log('   ⚠️  Google Drive not authorized - visit /api/drive/authorize as admin');
        } else {
            console.log('   ✓ Ready! Memos will be backed up to Google Drive automatically.');
        }

        await mongoose.disconnect();
        console.log('\n✓ Check complete!\n');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkDriveStatus();

