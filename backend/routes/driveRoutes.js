const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/isAuthenticated');
const googleDriveService = require('../services/googleDriveService');

/**
 * Initiate Google Drive authorization (admins only)
 * GET /api/drive/authorize
 */
router.get('/authorize', [isAuthenticated, require('../middleware/isAdmin')], async (req, res) => {
    try {
        const userId = req.user._id;
        const authUrl = googleDriveService.getAuthorizationUrl(userId);
        res.redirect(authUrl);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error initiating Drive authorization:', error);
        res.status(500).json({ success: false, message: 'Error initiating Google Drive authorization' });
    }
});

/**
 * Handle Google Drive OAuth callback
 * GET /api/drive/callback
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.status(400).send('Authorization code not provided');
        }

        // state contains the user ID
        const userId = state;
        await googleDriveService.handleOAuthCallback(code, userId);

        res.send(`
            <html>
                <head>
                    <title>Google Drive Connected</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                        }
                        .container {
                            background: white;
                            padding: 2rem;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        h1 { color: #34A853; }
                        button {
                            background: #1C89E3;
                            color: white;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 1rem;
                            margin-top: 1rem;
                        }
                        button:hover { background: #1a75d0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>✓ Google Drive Connected!</h1>
                        <p>Your memos will now be automatically backed up to Google Drive.</p>
                        <p>You can close this window.</p>
                        <button onclick="window.close()">Close</button>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error in Drive callback:', error);
        res.status(500).send(`
            <html>
                <head>
                    <title>Error</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                        }
                        .container {
                            background: white;
                            padding: 2rem;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        h1 { color: #EA4335; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>✗ Connection Error</h1>
                        <p>An error occurred while connecting Google Drive.</p>
                        <p>Please try again later.</p>
                    </div>
                </body>
            </html>
        `);
    }
});

/**
 * Check if Google Drive is connected system-wide
 * GET /api/drive/status
 */
router.get('/status', [isAuthenticated], async (req, res) => {
    try {
        const isConnected = await googleDriveService.isDriveConnected();

        res.json({
            success: true,
            connected: isConnected
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error checking Drive status:', error);
        res.status(500).json({ success: false, message: 'Error checking Google Drive status' });
    }
});

/**
 * Disconnect Google Drive (admins only)
 * DELETE /api/drive/disconnect
 */
router.delete('/disconnect', [isAuthenticated, require('../middleware/isAdmin')], async (req, res) => {
    try {
        const SystemSetting = require('../models/SystemSetting');

        // Remove system-wide Google Drive credentials
        await SystemSetting.deleteOne({ key: 'google_drive_refresh_token' });
        await SystemSetting.deleteOne({ key: 'google_drive_access_token' });
        await SystemSetting.deleteOne({ key: 'google_drive_token_expiry' });
        await SystemSetting.deleteOne({ key: 'google_drive_folder_id' });

        res.json({
            success: true,
            message: 'Google Drive disconnected successfully'
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error disconnecting Drive:', error);
        res.status(500).json({ success: false, message: 'Error disconnecting Google Drive' });
    }
});

/**
 * Configure Google Drive folder ID (admins only)
 * POST /api/drive/folder
 * Body: { folderId: string }
 */
router.post('/folder', [isAuthenticated, require('../middleware/isAdmin')], async (req, res) => {
    try {
        const { folderId } = req.body;

        if (!folderId) {
            return res.status(400).json({ success: false, message: 'Folder ID is required' });
        }

        const userId = req.user._id;
        await googleDriveService.setFolderId(folderId, userId);

        res.json({
            success: true,
            message: 'Google Drive folder configured successfully'
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error setting folder:', error);
        res.status(500).json({ success: false, message: 'Error configuring Google Drive folder' });
    }
});

/**
 * Get current Google Drive folder ID
 * GET /api/drive/folder
 */
router.get('/folder', [isAuthenticated, require('../middleware/isAdmin')], async (req, res) => {
    try {
        const SystemSetting = require('../models/SystemSetting');
        const folderId = await SystemSetting.get('google_drive_folder_id');

        res.json({
            success: true,
            folderId: folderId || null
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error getting folder:', error);
        res.status(500).json({ success: false, message: 'Error getting Google Drive folder' });
    }
});

module.exports = router;

