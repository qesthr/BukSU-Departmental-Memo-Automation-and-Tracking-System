const { google } = require('googleapis');
const SystemSetting = require('../models/SystemSetting');
const path = require('path');
const fs = require('fs');

/**
 * Get OAuth2 client for Google Drive
 */
// eslint-disable-next-line no-unused-vars
function getOAuth2Client(user) {
    const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI ||
        (process.env.BASE_URL ? `${process.env.BASE_URL}/api/drive/callback` : 'http://localhost:5000/api/drive/callback');

    if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
        throw new Error('Google Drive credentials not configured. Please set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in environment variables.');
    }

    return new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        redirectUri
    );
}

/**
 * Get authenticated Google Drive client using system-wide credentials
 * Handles token refresh automatically and saves new tokens
 */
async function getAuthenticatedDriveClient() {
    try {
        // Get system-wide Google Drive credentials
        const refreshToken = await SystemSetting.get('google_drive_refresh_token');
        const accessToken = await SystemSetting.get('google_drive_access_token');
        const tokenExpiry = await SystemSetting.get('google_drive_token_expiry');

        if (!refreshToken) {
            throw new Error('Google Drive has not been connected to the system. Please connect Google Drive first.');
        }

        const oauth2Client = getOAuth2Client(null);

        // Set credentials
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken,
            expiry_date: tokenExpiry ? (typeof tokenExpiry === 'number' ? tokenExpiry : new Date(tokenExpiry).getTime()) : null
        });

        // Listen for token refresh events and save automatically
        oauth2Client.on('tokens', (tokens) => {
            if (tokens.refresh_token) {
                // Save refresh token if provided (usually only on first auth)
                SystemSetting.set('google_drive_refresh_token', tokens.refresh_token).catch(err => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to save refresh token:', err);
                });
            }
            if (tokens.access_token) {
                SystemSetting.set('google_drive_access_token', tokens.access_token).catch(err => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to save access token:', err);
                });
            }
            if (tokens.expiry_date) {
                SystemSetting.set('google_drive_token_expiry', tokens.expiry_date).catch(err => {
                    // eslint-disable-next-line no-console
                    console.error('Failed to save token expiry:', err);
                });
            }
            // eslint-disable-next-line no-console
            console.log('🔄 Google Drive token refreshed automatically');
        });

        // Check if token needs refresh (refresh if expired or expires in next 5 minutes)
        const now = Date.now();
        const expiryTime = tokenExpiry ? (typeof tokenExpiry === 'number' ? tokenExpiry : new Date(tokenExpiry).getTime()) : 0;
        const fiveMinutes = 5 * 60 * 1000;

        if (!expiryTime || now >= (expiryTime - fiveMinutes)) {
            // eslint-disable-next-line no-console
            console.log('🔄 Refreshing Google Drive access token...');
            try {
                const { credentials } = await oauth2Client.refreshAccessToken();

                // Update system settings with new tokens (fallback if event listener fails)
                if (credentials.access_token) {
                    await SystemSetting.set('google_drive_access_token', credentials.access_token);
                }
                if (credentials.expiry_date) {
                    await SystemSetting.set('google_drive_token_expiry', credentials.expiry_date);
                }
                if (credentials.refresh_token) {
                    await SystemSetting.set('google_drive_refresh_token', credentials.refresh_token);
                }
                // eslint-disable-next-line no-console
                console.log('✅ Google Drive token refreshed successfully');
            } catch (refreshError) {
                // eslint-disable-next-line no-console
                console.error('❌ Failed to refresh Google Drive token:', refreshError.message);
                throw new Error(`Failed to refresh Google Drive token: ${refreshError.message}. Please reconnect Google Drive.`);
            }
        }

        return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ Error getting authenticated Drive client:', error.message);
        throw error;
    }
}

/**
 * Get the shared "Memofy" folder ID from system settings or environment
 */
async function getMemofyFolderId() {
    try {
        // First, check if admin has specified a folder ID in system settings
        const existingFolderId = await SystemSetting.get('google_drive_folder_id');
        if (existingFolderId) {
            return existingFolderId;
        }

        // If no folder ID is stored, check environment variable for a specific folder
        if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
            // Store it in system settings for future use
            await SystemSetting.set('google_drive_folder_id', process.env.GOOGLE_DRIVE_FOLDER_ID);
            return process.env.GOOGLE_DRIVE_FOLDER_ID;
        }

        // If no folder is specified, create a new "Memofy" folder
        const drive = await getAuthenticatedDriveClient();

        // First, try to find the Memofy folder
        const folderName = 'Memofy';

        const response = await drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        let folderId;

        if (response.data.files.length > 0) {
            folderId = response.data.files[0].id;
        } else {
            // If not found, create it
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            };

            const folder = await drive.files.create({
                resource: fileMetadata,
                fields: 'id',
            });

            folderId = folder.data.id;
        }

        // Store the folder ID for future use
        await SystemSetting.set('google_drive_folder_id', folderId);

        return folderId;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error getting Memofy folder:', error);
        throw error;
    }
}

/**
 * Upload memo to Google Drive as a PDF with embedded images and text
 * This function handles the complete backup process asynchronously
 */
async function uploadMemoToDrive(memo) {
    let pdfPath = null;
    try {
        // Check if Drive is connected first
        const isConnected = await isDriveConnected();
        if (!isConnected) {
            // eslint-disable-next-line no-console
            console.log('⚠️ Google Drive not connected - skipping backup');
            throw new Error('Google Drive is not connected. Please connect Google Drive first.');
        }

        // eslint-disable-next-line no-console
        console.log(`\n📤 Starting Google Drive backup for memo: "${memo.subject || 'Untitled'}"`);

        const PDFDocument = require('pdfkit');
        const drive = await getAuthenticatedDriveClient();
        const folderId = await getMemofyFolderId();

        // eslint-disable-next-line no-console
        console.log(`  📁 Target folder ID: ${folderId}`);

        // Create a temporary PDF file
        pdfPath = path.join(__dirname, '../../uploads', `memo-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
        const pdfDoc = new PDFDocument({ margin: 50 });

        // eslint-disable-next-line no-console
        console.log('  📄 Creating PDF file...');

        // Header
        pdfDoc.fontSize(20).text('MEMO', { align: 'center' });
        pdfDoc.moveDown(2);

        // Memo Details
        pdfDoc.fontSize(12)
            .text(`Subject: ${memo.subject || 'No subject'}`, { align: 'left' })
            .text(`From: ${memo.sender?.firstName || ''} ${memo.sender?.lastName || ''} (${memo.sender?.email || ''})`)
            .text(`To: ${memo.recipient?.firstName || ''} ${memo.recipient?.lastName || ''} (${memo.recipient?.email || ''})`)
            .text(`Department: ${memo.department || 'N/A'}`)
            .text(`Priority: ${memo.priority || 'medium'}`)
            .text(`Date: ${new Date(memo.createdAt || Date.now()).toLocaleString()}`)
            .moveDown(1);

        // Divider line
        pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke();

        pdfDoc.moveDown(1.5);

        // Content
        if (memo.content) {
            pdfDoc.fontSize(11).text(memo.content, { align: 'left' });
        } else {
            pdfDoc.fontSize(11).text('(No content)', { align: 'left', italic: true });
        }

        // Add images if attachments exist
        if (memo.attachments && memo.attachments.length > 0) {
            pdfDoc.moveDown(2);
            pdfDoc.fontSize(11).text('Attachments:', { bold: true });
            pdfDoc.moveDown(1);

            for (const attachment of memo.attachments) {
                const filePath = attachment.path || path.join(__dirname, '../../uploads', attachment.filename);

                if (fs.existsSync(filePath)) {
                    // Check if it's an image
                    const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

                    if (isImage) {
                        pdfDoc.moveDown(1);
                        pdfDoc.fontSize(10).text(`• ${attachment.filename}`, { indent: 20 });

                        try {
                            // Calculate image dimensions to fit page
                            const imageWidth = 450; // Max width
                            const xPosition = 50;

                            // Embed image in PDF
                            pdfDoc.image(filePath, xPosition, pdfDoc.y, { fit: [imageWidth, 600] });

                            pdfDoc.moveDown(1);
                        } catch (imgError) {
                            // eslint-disable-next-line no-console
                            console.error(`  Could not embed image ${attachment.filename}:`, imgError.message);
                            pdfDoc.text('  (Image could not be embedded)', { indent: 20 });
                        }
                    } else {
                        pdfDoc.fontSize(10).text(`• ${attachment.filename} (${attachment.mimetype || 'file'})`, { indent: 20 });
                    }
                } else {
                    // eslint-disable-next-line no-console
                    console.warn(`  ⚠️ Attachment file not found: ${filePath}`);
                    pdfDoc.fontSize(10).text(`• ${attachment.filename} (file not found on server)`, { indent: 20 });
                }
            }
        }

        // Set up file stream
        const writeStream = fs.createWriteStream(pdfPath);

        // Wait for PDF to be written
        const pdfReady = new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            pdfDoc.on('error', reject);
        });

        // Pipe PDF to file
        pdfDoc.pipe(writeStream);

        // Finalize PDF
        pdfDoc.end();

        // Wait for PDF to be written to disk
        await pdfReady;

        // eslint-disable-next-line no-console
        console.log('  ✅ PDF created, uploading to Google Drive...');

        // Upload PDF to Google Drive
        // Sanitize filename - remove invalid characters for Drive
        const sanitizedSubject = (memo.subject || 'Untitled Memo')
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars with underscore
            .trim()
            .substring(0, 100); // Limit length

        const timestamp = new Date(memo.createdAt || Date.now()).toISOString().split('T')[0];
        const fileName = `${sanitizedSubject}_${timestamp}.pdf`;

        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };

        // eslint-disable-next-line no-console
        console.log(`  ☁️ Uploading to Google Drive: ${fileName}...`);

        const file = await drive.files.create({
            resource: fileMetadata,
            media: {
                mimeType: 'application/pdf',
                body: fs.createReadStream(pdfPath)
            },
            fields: 'id, webViewLink, webContentLink'
        });

        // eslint-disable-next-line no-console
        console.log('  ✅ PDF uploaded successfully, cleaning up...');

        // Clean up temporary PDF file
        if (pdfPath && fs.existsSync(pdfPath)) {
            try {
                fs.unlinkSync(pdfPath);
                // eslint-disable-next-line no-console
                console.log('  🗑️ Temporary PDF file deleted');
            } catch (unlinkError) {
                // eslint-disable-next-line no-console
                console.warn('  ⚠️ Could not delete temporary PDF:', unlinkError.message);
            }
        }

        // Grant permissions to view (optional - remove if you want private files)
        try {
            await drive.permissions.create({
                fileId: file.data.id,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
        } catch (permError) {
            // eslint-disable-next-line no-console
            console.warn('  ⚠️ Could not set file permissions:', permError.message);
            // Don't fail if permissions can't be set
        }

        // eslint-disable-next-line no-console
        console.log(`  ✅ Backup complete! PDF created with ${memo.attachments?.length || 0} attachment(s)`);
        // eslint-disable-next-line no-console
        console.log(`  ✅ Google Drive File ID: ${file.data.id}`);
        if (file.data.webViewLink) {
            // eslint-disable-next-line no-console
            console.log(`  🔗 View in Drive: ${file.data.webViewLink}`);
        }

        return file.data.id;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ Google Drive backup failed:', error.message);
        // eslint-disable-next-line no-console
        console.error('  Error details:', {
            subject: memo?.subject || 'Unknown',
            error: error.message,
            code: error.code,
            response: error.response?.data || 'No response data'
        });

        // Clean up PDF file if it exists
        if (pdfPath && fs.existsSync(pdfPath)) {
            try {
                fs.unlinkSync(pdfPath);
            } catch (unlinkError) {
                // Ignore cleanup errors
            }
        }

        throw error;
    }
}

/**
 * Get authorization URL for Google Drive
 */
function getAuthorizationUrl(userId) {
    const oauth2Client = getOAuth2Client(null);

    const scopes = [
        'https://www.googleapis.com/auth/drive.file'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: userId,
        prompt: 'consent'
    });

    return authUrl;
}

/**
 * Handle OAuth callback and store system-wide tokens
 */
async function handleOAuthCallback(code, userId) {
    try {
        const oauth2Client = getOAuth2Client();

        const { tokens } = await oauth2Client.getToken(code);

        // Store system-wide Google Drive credentials
        await SystemSetting.set('google_drive_refresh_token', tokens.refresh_token, userId);
        await SystemSetting.set('google_drive_access_token', tokens.access_token, userId);
        await SystemSetting.set('google_drive_token_expiry', tokens.expiry_date, userId);

        return { success: true };
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error handling OAuth callback:', error);
        throw error;
    }
}

/**
 * Check if Google Drive is connected system-wide
 */
async function isDriveConnected() {
    try {
        const refreshToken = await SystemSetting.get('google_drive_refresh_token');
        return !!refreshToken;
    } catch {
        return false;
    }
}

/**
 * Set the Google Drive folder ID for memo storage (admin function)
 */
async function setFolderId(folderId, userId) {
    await SystemSetting.set('google_drive_folder_id', folderId, userId);
    return { success: true };
}

module.exports = {
    getOAuth2Client,
    getAuthenticatedDriveClient,
    getMemofyFolderId,
    uploadMemoToDrive,
    getAuthorizationUrl,
    handleOAuthCallback,
    isDriveConnected,
    setFolderId
};
