const { google } = require('googleapis');
const SystemSetting = require('../models/SystemSetting');
const path = require('path');
const fs = require('fs');

/**
 * Get OAuth2 client for Google Drive
 */
// eslint-disable-next-line no-unused-vars
function getOAuth2Client(user) {
    return new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        process.env.GOOGLE_DRIVE_REDIRECT_URI || process.env.BASE_URL + '/api/drive/callback'
    );
}

/**
 * Get authenticated Google Drive client using system-wide credentials
 */
async function getAuthenticatedDriveClient() {
    try {
        // Get system-wide Google Drive credentials
        const refreshToken = await SystemSetting.get('google_drive_refresh_token');
        const accessToken = await SystemSetting.get('google_drive_access_token');
        const tokenExpiry = await SystemSetting.get('google_drive_token_expiry');

        if (!refreshToken) {
            throw new Error('Google Drive has not been connected to the system');
        }

        const oauth2Client = getOAuth2Client(null);

        // Set credentials
        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken,
            expiry_date: tokenExpiry ? new Date(tokenExpiry).getTime() : null
        });

        // Check if token needs refresh
        if (tokenExpiry && new Date() >= new Date(tokenExpiry)) {
            // eslint-disable-next-line no-console
            console.log('Token expired, refreshing...');
            const { credentials } = await oauth2Client.refreshAccessToken();

            // Update system settings with new tokens
            await SystemSetting.set('google_drive_access_token', credentials.access_token);
            await SystemSetting.set('google_drive_token_expiry', credentials.expiry_date);
        }

        return google.drive({ version: 'v3', auth: oauth2Client });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error getting authenticated Drive client:', error);
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
 */
async function uploadMemoToDrive(memo) {
    let pdfPath = null;
    try {
        const PDFDocument = require('pdfkit');
        const drive = await getAuthenticatedDriveClient();
        const folderId = await getMemofyFolderId();

        // Create a temporary PDF file
        pdfPath = path.join(__dirname, '../../uploads', `memo-${Date.now()}.pdf`);
        const pdfDoc = new PDFDocument({ margin: 50 });

        // eslint-disable-next-line no-console
        console.log('  Creating PDF file...');

        // Header
        pdfDoc.fontSize(20).text('MEMO', { align: 'center' });
        pdfDoc.moveDown(2);

        // Memo Details
        pdfDoc.fontSize(12)
            .text(`Subject: ${memo.subject}`, { align: 'left' })
            .text(`From: ${memo.sender?.firstName || ''} ${memo.sender?.lastName || ''} (${memo.sender?.email || ''})`)
            .text(`To: ${memo.recipient?.firstName || ''} ${memo.recipient?.lastName || ''} (${memo.recipient?.email || ''})`)
            .text(`Department: ${memo.department || 'N/A'}`)
            .text(`Priority: ${memo.priority || 'medium'}`)
            .text(`Date: ${new Date(memo.createdAt).toLocaleString()}`)
            .moveDown(1);

        // Divider line
        pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke();

        pdfDoc.moveDown(1.5);

        // Content
        pdfDoc.fontSize(11).text(memo.content, { align: 'left' });

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
                        pdfDoc.fontSize(10).text(`• ${attachment.filename}`, { indent: 20 });
                    }
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
        console.log('  PDF created, uploading to Google Drive...');

        // Upload PDF to Google Drive
        const fileMetadata = {
            name: `${memo.subject} - ${new Date(memo.createdAt).toISOString().split('T')[0]}.pdf`,
            parents: [folderId]
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: {
                mimeType: 'application/pdf',
                body: fs.createReadStream(pdfPath)
            },
            fields: 'id'
        });

        // eslint-disable-next-line no-console
        console.log('  PDF uploaded successfully, cleaning up...');

        // Clean up temporary PDF file
        if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
        }

        // Grant permissions to view
        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        // eslint-disable-next-line no-console
        console.log(`  ✓ Created PDF with ${memo.attachments?.length || 0} embedded images`);
        // eslint-disable-next-line no-console
        console.log(`  ✓ PDF uploaded to Google Drive: ${file.data.id}`);

        return file.data.id;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('✗ Error uploading memo to Google Drive:', error.message);
        // eslint-disable-next-line no-console
        console.error('  Error stack:', error.stack);

        // Clean up PDF file if it exists
        if (pdfPath && fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
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

