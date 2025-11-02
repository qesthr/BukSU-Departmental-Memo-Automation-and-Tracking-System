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

        // First, upload all attachment files to Google Drive and get their shareable links
        const attachmentDriveUrls = {};
        if (memo.attachments && memo.attachments.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`  📎 Uploading ${memo.attachments.length} attachment(s) to Google Drive...`);

            for (const attachment of memo.attachments) {
                // Try multiple possible paths for the file
                let filePath = attachment.path;
                if (!filePath || !fs.existsSync(filePath)) {
                    filePath = path.join(__dirname, '../../uploads', attachment.filename);
                }
                // Also try with just the filename in uploads
                if (!fs.existsSync(filePath)) {
                    filePath = path.join(__dirname, '../../uploads', path.basename(attachment.filename));
                }

                if (fs.existsSync(filePath)) {
                    try {
                        // Sanitize filename for Google Drive
                        const sanitizedFilename = attachment.filename
                            .replace(/[<>:"/\\|?*]/g, '_')
                            .trim()
                            .substring(0, 200);

                        // Upload attachment file to Google Drive
                        const attachmentFileMetadata = {
                            name: sanitizedFilename,
                            parents: [folderId]
                        };

                        const attachmentFile = await drive.files.create({
                            resource: attachmentFileMetadata,
                            media: {
                                mimeType: attachment.mimetype || 'application/octet-stream',
                                body: fs.createReadStream(filePath)
                            },
                            fields: 'id, webViewLink, webContentLink'
                        });

                        // Make file publicly viewable
                        try {
                            await drive.permissions.create({
                                fileId: attachmentFile.data.id,
                                requestBody: {
                                    role: 'reader',
                                    type: 'anyone'
                                }
                            });
                        } catch (permError) {
                            // eslint-disable-next-line no-console
                            console.warn(`  ⚠️ Could not set permissions for ${attachment.filename}:`, permError.message);
                        }

                        // Store the Google Drive link
                        attachmentDriveUrls[attachment.filename] = attachmentFile.data.webViewLink || attachmentFile.data.webContentLink;

                        // eslint-disable-next-line no-console
                        console.log(`  ✅ Uploaded attachment to Drive: ${attachment.filename} -> ${attachmentFile.data.id}`);
                    } catch (uploadError) {
                        // eslint-disable-next-line no-console
                        console.error(`  ⚠️ Failed to upload attachment ${attachment.filename}:`, uploadError.message);
                        // Use fallback URL if upload fails
                        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
                        attachmentDriveUrls[attachment.filename] = attachment.url || `${baseUrl}/uploads/${encodeURIComponent(attachment.filename)}`;
                    }
                } else {
                    // eslint-disable-next-line no-console
                    console.warn(`  ⚠️ Attachment file not found: ${filePath}`);
                    // Use fallback URL
                    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
                    attachmentDriveUrls[attachment.filename] = attachment.url || `${baseUrl}/uploads/${encodeURIComponent(attachment.filename)}`;
                }
            }
        }

        // Add images if attachments exist
        if (memo.attachments && memo.attachments.length > 0) {
            pdfDoc.moveDown(2);
            pdfDoc.fontSize(11).text('Attachments:', { bold: true });
            pdfDoc.moveDown(1);

            for (const attachment of memo.attachments) {
                // Try multiple possible paths for the file
                let filePath = attachment.path;
                if (!filePath || !fs.existsSync(filePath)) {
                    filePath = path.join(__dirname, '../../uploads', attachment.filename);
                }
                // Also try with just the filename in uploads
                if (!fs.existsSync(filePath)) {
                    filePath = path.join(__dirname, '../../uploads', path.basename(attachment.filename));
                }

                // Use Google Drive URL if available, otherwise fallback to local URL
                const attachmentUrl = attachmentDriveUrls[attachment.filename] ||
                    attachment.url ||
                    `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/${encodeURIComponent(attachment.filename)}`;

                if (fs.existsSync(filePath)) {
                    // Check if it's an image (original) or a PDF that was converted from an image
                    const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');
                    const isPDF = attachment.mimetype === 'application/pdf';

                    // Check if PDF was converted from an image by looking at the original filename
                    // If the original filename had image extension but now it's PDF, it was converted
                    const originalExt = path.extname(attachment.filename).toLowerCase();
                    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
                    const wasImage = imageExtensions.includes(originalExt) && isPDF;

                    // eslint-disable-next-line no-console
                    console.log(`  📎 Processing attachment: ${attachment.filename} (isImage: ${isImage}, isPDF: ${isPDF}, wasImage: ${wasImage})`);

                    if (isImage || wasImage) {
                        pdfDoc.moveDown(1);
                        const linkStartY = pdfDoc.y;

                        // Create clickable filename link (blue, underlined)
                        pdfDoc.fontSize(10);
                        pdfDoc.fillColor('#0066cc');
                        pdfDoc.text(`• `, { indent: 20 });
                        const filenameX = 70; // Position after bullet and indent
                        const filenameY = pdfDoc.y;
                        const filenameText = attachment.filename;
                        const filenameWidth = pdfDoc.widthOfString(filenameText);
                        const filenameHeight = 12;

                        // Draw the clickable filename
                        pdfDoc.text(filenameText, {
                            indent: 20,
                            underline: true,
                            link: attachmentUrl
                        });

                        try {
                            if (wasImage && isPDF) {
                                // This shouldn't happen anymore since we keep images as images
                                // But if it does (old memos), just show a note
                                pdfDoc.moveDown(0.5);
                                pdfDoc.fontSize(9);
                                pdfDoc.fillColor('#666');
                                pdfDoc.text('   (Click filename above to view PDF)', { indent: 40 });
                                pdfDoc.moveDown(0.5);
                            } else if (isImage) {
                                // For original images, embed them directly in the PDF so they're visible immediately
                                pdfDoc.moveDown(0.5);
                                const imageY = pdfDoc.y;
                                const imageWidth = 450; // Max width
                                const xPosition = 50;

                                // Embed image in PDF - this makes it visible inline, no clicking needed!
                                pdfDoc.image(filePath, xPosition, imageY, { fit: [imageWidth, 600] });

                                // Make the entire image area clickable too (opens full size in Google Drive)
                                // Estimate image height for clickable area
                                const imageHeight = Math.min(600, imageWidth * 0.75); // Rough estimate
                                pdfDoc.link(xPosition, imageY, imageWidth, imageHeight, attachmentUrl);

                                pdfDoc.moveDown(1);

                                // eslint-disable-next-line no-console
                                console.log(`  ✅ Embedded image inline in PDF: ${attachment.filename}`);
                            }
                        } catch (imgError) {
                            // eslint-disable-next-line no-console
                            console.error(`  ⚠️ Could not embed image ${attachment.filename}:`, imgError.message);
                            pdfDoc.fontSize(9);
                            pdfDoc.fillColor('#999');
                            pdfDoc.text('   (Click filename above to view)', { indent: 40 });
                        }

                        // Reset color
                        pdfDoc.fillColor('#000');
                    } else {
                        // For non-image files (PDFs, docs, etc.), create clickable link
                        pdfDoc.moveDown(1);
                        pdfDoc.fontSize(10);

                        // Draw bullet point
                        pdfDoc.text(`• `, { indent: 20 });

                        // Create clickable link for the filename (blue, underlined)
                        pdfDoc.fillColor('#0066cc');
                        pdfDoc.text(attachment.filename, {
                            indent: 20,
                            link: attachmentUrl,
                            underline: true
                        });

                        // Add file type info (gray, not clickable)
                        pdfDoc.fontSize(9);
                        pdfDoc.fillColor('#666');
                        pdfDoc.text(` (${attachment.mimetype || 'file'})`, {
                            link: null // Don't make the type clickable
                        });

                        // Reset color
                        pdfDoc.fillColor('#000');
                    }
                } else {
                    // eslint-disable-next-line no-console
                    console.warn(`  ⚠️ Attachment file not found: ${filePath}`);

                    // Still create clickable link even if file not found locally
                    pdfDoc.moveDown(1);
                    pdfDoc.fontSize(10);
                    pdfDoc.text(`• `, { indent: 20 });
                    pdfDoc.text(attachment.filename, {
                        indent: 20,
                        link: attachmentUrl,
                        underline: true,
                        color: '#0066cc'
                    });
                    pdfDoc.fontSize(9).text(' (file not found on server - link may work)', {
                        indent: 40,
                        color: '#999',
                        link: null
                    });
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
