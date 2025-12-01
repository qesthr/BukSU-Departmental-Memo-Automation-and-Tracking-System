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
        const pdfDoc = new PDFDocument({ margin: 50, size: 'LETTER' });

        // Helper function to ensure we have enough space and add page if needed
        const ensureSpace = (requiredHeight) => {
            const pageHeight = pdfDoc.page.height;
            const bottomMargin = 50;
            const currentY = pdfDoc.y;
            const availableHeight = pageHeight - currentY - bottomMargin;

            if (availableHeight < requiredHeight) {
                pdfDoc.addPage();
                // eslint-disable-next-line no-console
                console.log(`  📄 Added new page (needed ${requiredHeight}px, had ${availableHeight}px)`);
                return true; // Page was added
            }
            return false; // No page needed
        };

        // eslint-disable-next-line no-console
        console.log('  📄 Creating PDF file...');

        // Header
        pdfDoc.fontSize(20).text('MEMO', { align: 'center' });
        pdfDoc.moveDown(2);

        // Memo Details
        // For secretary-created memos, recipient field is set to secretary for tracking
        // But actual recipients are in the recipients array - show first recipient or all recipients
        let recipientDisplay = '';
        if (memo.recipients && Array.isArray(memo.recipients) && memo.recipients.length > 0) {
            // If recipients array exists and has items, use the first recipient
            // Note: recipients array contains IDs, so we need to populate them
            // For now, show recipient field if it's not the same as sender (admin memos)
            // Otherwise, show "Multiple recipients" or first recipient email if available
            if (memo.recipient && memo.recipient.email &&
                memo.sender && memo.sender.email &&
                memo.recipient.email !== memo.sender.email) {
                // Normal case: recipient is different from sender
                recipientDisplay = `${memo.recipient?.firstName || ''} ${memo.recipient?.lastName || ''} (${memo.recipient?.email || ''})`;
            } else {
                // Secretary-created memo: recipient field is secretary, but actual recipients are in recipients array
                recipientDisplay = `Multiple recipients (${memo.recipients.length} recipient${memo.recipients.length > 1 ? 's' : ''})`;
            }
        } else if (memo.recipient) {
            // Fallback to recipient field if recipients array is empty
            recipientDisplay = `${memo.recipient?.firstName || ''} ${memo.recipient?.lastName || ''} (${memo.recipient?.email || ''})`;
        } else {
            recipientDisplay = 'N/A';
        }

        pdfDoc.fontSize(12)
            .text(`Subject: ${memo.subject || 'No subject'}`, { align: 'left' })
            .text(`From: ${memo.sender?.firstName || ''} ${memo.sender?.lastName || ''} (${memo.sender?.email || ''})`)
            .text(`To: ${recipientDisplay}`)
            .text(`Department: ${memo.department || 'N/A'}`)
            .text(`Priority: ${memo.priority || 'medium'}`)
            .text(`Date: ${new Date(memo.createdAt || Date.now()).toLocaleString()}`)
            .moveDown(1);

        // Divider line
        pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke();

        pdfDoc.moveDown(1.5);

        // Helper functions for HTML processing
        function sanitizeHTML(html) {
            if (!html) {return '';}
            return html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/<iframe/gi, '&lt;iframe');
        }

        function htmlToPlainText(html) {
            if (!html) {return '';}
            let text = html;
            text = text.replace(/<br\s*\/?>/gi, '\n');
            text = text.replace(/<\/p>/gi, '\n\n');
            text = text.replace(/<\/div>/gi, '\n');
            text = text.replace(/<li>/gi, '\n• ');
            text = text.replace(/<\/li>/gi, '');
            text = text.replace(/&nbsp;/gi, ' ');
            text = text.replace(/&amp;/gi, '&');
            text = text.replace(/&lt;/gi, '<');
            text = text.replace(/&gt;/gi, '>');
            text = text.replace(/&quot;/gi, '"');
            text = text.replace(/&#39;/gi, '\'');
            text = text.replace(/<[^>]+>/g, '');
            text = text.replace(/\r/g, '');
            text = text.replace(/\n{3,}/g, '\n\n');
            return text.trim();
        }

        // Process content: convert HTML to plain text and extract inline images
        const sanitizedContent = sanitizeHTML(memo.content);
        const plainContent = htmlToPlainText(sanitizedContent);

        // Extract inline images from HTML content
        const inlineImages = [];
        if (sanitizedContent) {
            const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
            let match;
            while ((match = imgRegex.exec(sanitizedContent)) !== null) {
                const imgSrc = match[1];
                if (imgSrc && !imgSrc.startsWith('data:')) {
                    inlineImages.push(imgSrc);
                }
            }
        }

        // Content - PDFKit's text() method automatically handles page breaks
        if (plainContent) {
            // Ensure we have some space before adding content
            ensureSpace(100);
            pdfDoc.fontSize(11).text(plainContent, { align: 'left', lineGap: 4 });
        } else {
            // If there is no content at all, just leave the body area blank in the PDF
        }

        // Embed inline images from content
        if (inlineImages.length > 0) {
            pdfDoc.moveDown(1);
            for (const imgSrc of inlineImages) {
                try {
                    let imagePath = imgSrc;
                    if (imgSrc.startsWith('/uploads/')) {
                        imagePath = path.join(__dirname, '../../uploads', path.basename(imgSrc));
                    } else if (imgSrc.startsWith('uploads/')) {
                        imagePath = path.join(__dirname, '../../uploads', path.basename(imgSrc));
                    } else if (!path.isAbsolute(imgSrc)) {
                        imagePath = path.join(__dirname, '../../uploads', path.basename(imgSrc));
                    }

                    if (fs.existsSync(imagePath)) {
                        ensureSpace(400);
                        const maxWidth = 450;
                        const maxHeight = 400;
                        pdfDoc.image(imagePath, 50, pdfDoc.y, { fit: [maxWidth, maxHeight], align: 'left' });
                        pdfDoc.moveDown(1);
                    }
                } catch (imgError) {
                    // eslint-disable-next-line no-console
                    console.warn('Could not embed inline image:', imgError.message);
                }
            }
        }

        // Ensure we have space after content before attachments
        ensureSpace(100);

        // Generate attachment URLs for linking in PDF (using local server URLs)
        // We don't upload individual attachments - only the memo PDF itself
        const attachmentUrls = {};
        if (memo.attachments && memo.attachments.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`  📎 Processing ${memo.attachments.length} attachment(s) for PDF links...`);

            for (const attachment of memo.attachments) {
                // Use local server URL for attachments (clickable links in PDF)
                const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
                attachmentUrls[attachment.filename] = attachment.url || `${baseUrl}/uploads/${encodeURIComponent(attachment.filename)}`;
                // eslint-disable-next-line no-console
                console.log(`  📎 Attachment link: ${attachment.filename} -> ${attachmentUrls[attachment.filename]}`);
            }
        }

        // Add images if attachments exist
        if (memo.attachments && memo.attachments.length > 0) {
            // Ensure we have space for attachments section
            ensureSpace(150);
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

                    // Use local server URL for attachment links (clickable in PDF)
                    const attachmentUrl = attachmentUrls[attachment.filename] ||
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

                                const maxImageWidth = 450; // Max width for images
                                const xPosition = 50;
                                const maxImageHeight = 600; // Max height for images

                                // Get image dimensions to calculate actual rendered size
                                let originalWidth = maxImageWidth;
                                let originalHeight = maxImageHeight;
                                let aspectRatio = 1;

                                try {
                                    const sizeOf = require('image-size');
                                    const dimensions = sizeOf(filePath);
                                    originalWidth = dimensions.width;
                                    originalHeight = dimensions.height;
                                    aspectRatio = originalWidth / originalHeight;
                                } catch (sizeError) {
                                    // If image-size fails, use default max dimensions
                                    // eslint-disable-next-line no-console
                                    console.warn(`  ⚠️ Could not get image dimensions, using defaults:`, sizeError.message);
                                }

                                // Calculate available space on current page
                                const pageHeight = pdfDoc.page.height;
                                const bottomMargin = 50;
                                const currentY = pdfDoc.y;
                                const availableHeight = pageHeight - currentY - bottomMargin;

                                // Calculate rendered dimensions based on fit constraints (maintaining aspect ratio)
                                let renderedWidth = maxImageWidth;
                                let renderedHeight = maxImageHeight;

                                if (originalWidth > maxImageWidth || originalHeight > maxImageHeight) {
                                    // Need to scale down - use the smaller scale factor to maintain aspect ratio
                                    const widthRatio = maxImageWidth / originalWidth;
                                    const heightRatio = maxImageHeight / originalHeight;
                                    const scale = Math.min(widthRatio, heightRatio);
                                    renderedWidth = originalWidth * scale;
                                    renderedHeight = originalHeight * scale;
                                } else {
                                    // Use original dimensions if smaller than max
                                    renderedWidth = originalWidth;
                                    renderedHeight = originalHeight;
                                }

                                // Further constrain by available page height
                                if (renderedHeight > availableHeight - 30) {
                                    const heightScale = (availableHeight - 30) / renderedHeight;
                                    renderedHeight = availableHeight - 30;
                                    renderedWidth = renderedWidth * heightScale;
                                }

                                // Ensure we have enough space for the image plus spacing
                                const requiredSpace = renderedHeight + 40; // Image height + spacing
                                ensureSpace(requiredSpace);

                                // Recalculate after ensureSpace (might have added a new page)
                                const finalY = pdfDoc.y;
                                const finalAvailableHeight = pdfDoc.page.height - finalY - bottomMargin;

                                // Adjust rendered height if needed after page break
                                let finalRenderedHeight = renderedHeight;
                                if (finalRenderedHeight > finalAvailableHeight - 30) {
                                    const heightScale = (finalAvailableHeight - 30) / finalRenderedHeight;
                                    finalRenderedHeight = finalAvailableHeight - 30;
                                    renderedWidth = renderedWidth * heightScale;
                                }

                                const imageY = finalY;

                                // Embed image - PDFKit will automatically scale to fit [width, height] while maintaining aspect ratio
                                pdfDoc.image(filePath, xPosition, imageY, {
                                    fit: [maxImageWidth, finalRenderedHeight]
                                });

                                // Manually update pdfDoc.y to the position after the image
                                // PDFKit's fit maintains aspect ratio, so calculate actual rendered height
                                // The rendered height is constrained by both width and height limits
                                const heightFromWidth = maxImageWidth / aspectRatio;
                                const actualRenderedHeight = Math.min(finalRenderedHeight, heightFromWidth);

                                pdfDoc.y = imageY + actualRenderedHeight + 20; // Add spacing after image

                                // Double-check: if image somehow extended beyond page, add new page
                                if (pdfDoc.y > pdfDoc.page.height - bottomMargin) {
                                    pdfDoc.addPage();
                                    pdfDoc.moveDown(1);
                                    // eslint-disable-next-line no-console
                                    console.log(`  📄 Image extended beyond page, moved to next page`);
                                }

                                // Make the entire image area clickable
                                pdfDoc.link(xPosition, imageY, maxImageWidth, actualRenderedHeight, attachmentUrl);

                                // Add extra spacing between multiple images
                                pdfDoc.moveDown(1);
                                // eslint-disable-next-line no-console
                                console.log(`  ✅ Embedded image inline in PDF: ${attachment.filename} (${Math.round(renderedWidth)}x${Math.round(actualRenderedHeight)}px)`);
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

        // Add signatures if present
        if (memo.signatures && Array.isArray(memo.signatures) && memo.signatures.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`  ✍️ Processing ${memo.signatures.length} signature(s)...`);

            // Calculate required space for signatures
            // Each signature row needs: image (60px) + name (15px) + title (15px) + spacing (20px) = ~110px per row
            const numSignatureRows = Math.ceil(memo.signatures.length / 2);
            const signatureSectionHeight = (numSignatureRows * 110) + 150; // Add extra for divider and spacing

            // ALWAYS start signatures on a new page to ensure clean placement and avoid overlap
            // This guarantees signatures are never mixed with other content
            const pageHeight = pdfDoc.page.height;
            const currentY = pdfDoc.y;
            const topMargin = 50;

            // If we're not at the very top of a page, add a new page
            // This ensures signatures always have their own clean page
            if (currentY > topMargin + 20) {
                pdfDoc.addPage();
                // eslint-disable-next-line no-console
                console.log(`  📄 Added new page for signatures (was at ${Math.round(currentY)}px, ensuring clean placement)`);
            }

            // Double-check we have enough space (should always be true after adding page)
            ensureSpace(signatureSectionHeight);

            // Start signatures section with proper spacing from top of page
            pdfDoc.moveDown(2);

            // Add divider line before signatures
            pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke();
            pdfDoc.moveDown(1.5);

            // Calculate signature block width (2 signatures side by side, or 1 if only one)
            const numSignatures = memo.signatures.length;
            const signatureWidth = numSignatures === 1 ? 450 : 200; // Full width if 1, half if 2+
            const signatureSpacing = numSignatures > 1 ? 50 : 0;
            const startX = 50;

            // Group signatures - display up to 2 per row
            for (let i = 0; i < numSignatures; i += 2) {
                const sig1 = memo.signatures[i];
                const sig2 = memo.signatures[i + 1];

                // Check if we need a new page for this row (need at least 120px for a signature row)
                ensureSpace(120);

                const rowStartY = pdfDoc.y;
                const sig1Height = { image: 0, name: 0, title: 0, total: 0 };
                const sig2Height = { image: 0, name: 0, title: 0, total: 0 };

                // Process first signature in row
                if (sig1) {
                    const sig1X = startX;
                    let currentY = rowStartY;

                    // Try to load and embed signature image FIRST
                    if (sig1.imageUrl) {
                        try {
                            // Try multiple possible paths for signature image
                            let imagePath = sig1.imageUrl;
                            if (imagePath.startsWith('/')) {
                                imagePath = path.join(__dirname, '../../', imagePath.substring(1));
                            } else if (!path.isAbsolute(imagePath)) {
                                imagePath = path.join(__dirname, '../../uploads', imagePath);
                            }

                            if (fs.existsSync(imagePath) && fs.statSync(imagePath).isFile()) {
                                // Embed signature image at currentY position
                                const imageHeight = 60;
                                pdfDoc.image(imagePath, sig1X, currentY, {
                                    fit: [signatureWidth, imageHeight]
                                });
                                sig1Height.image = imageHeight;
                                currentY += imageHeight + 8; // Space after image
                            } else {
                                // Image not found, leave space
                                sig1Height.image = 60;
                                currentY += 60 + 8;
                            }
                        } catch (imgError) {
                            // eslint-disable-next-line no-console
                            console.warn(`  ⚠️ Could not load signature image for ${sig1.displayName || sig1.roleTitle}:`, imgError.message);
                            sig1Height.image = 60;
                            currentY += 60 + 8;
                        }
                    } else {
                        // No image, leave space
                        sig1Height.image = 60;
                        currentY += 60 + 8;
                    }

                    // Add signature name BELOW the image
                    const name = sig1.displayName || sig1.roleTitle || sig1.role || '';
                    const title = sig1.roleTitle || sig1.role || '';

                    pdfDoc.fontSize(11)
                        .font('Helvetica-Bold')
                        .text(name, sig1X, currentY, {
                            width: signatureWidth,
                            align: 'center'
                        });
                    sig1Height.name = 15;
                    currentY += 15;

                    // Add signature title BELOW the name
                    pdfDoc.fontSize(9)
                        .font('Helvetica')
                        .fillColor('#666')
                        .text(title, sig1X, currentY, {
                            width: signatureWidth,
                            align: 'center'
                        });
                    sig1Height.title = 12;
                    currentY += 12;

                    pdfDoc.fillColor('#000');
                    sig1Height.total = currentY - rowStartY;
                }

                // Process second signature in row (if exists)
                if (sig2) {
                    const sig2X = startX + signatureWidth + signatureSpacing;
                    let currentY = rowStartY;

                    // Try to load and embed signature image FIRST
                    if (sig2.imageUrl) {
                        try {
                            let imagePath = sig2.imageUrl;
                            if (imagePath.startsWith('/')) {
                                imagePath = path.join(__dirname, '../../', imagePath.substring(1));
                            } else if (!path.isAbsolute(imagePath)) {
                                imagePath = path.join(__dirname, '../../uploads', imagePath);
                            }

                            if (fs.existsSync(imagePath) && fs.statSync(imagePath).isFile()) {
                                // Embed signature image at currentY position
                                const imageHeight = 60;
                                pdfDoc.image(imagePath, sig2X, currentY, {
                                    fit: [signatureWidth, imageHeight]
                                });
                                sig2Height.image = imageHeight;
                                currentY += imageHeight + 8; // Space after image
                            } else {
                                sig2Height.image = 60;
                                currentY += 60 + 8;
                            }
                        } catch (imgError) {
                            // eslint-disable-next-line no-console
                            console.warn(`  ⚠️ Could not load signature image for ${sig2.displayName || sig2.roleTitle}:`, imgError.message);
                            sig2Height.image = 60;
                            currentY += 60 + 8;
                        }
                    } else {
                        sig2Height.image = 60;
                        currentY += 60 + 8;
                    }

                    // Add signature name BELOW the image
                    const name = sig2.displayName || sig2.roleTitle || sig2.role || '';
                    const title = sig2.roleTitle || sig2.role || '';

                    pdfDoc.fontSize(11)
                        .font('Helvetica-Bold')
                        .text(name, sig2X, currentY, {
                            width: signatureWidth,
                            align: 'center'
                        });
                    sig2Height.name = 15;
                    currentY += 15;

                    // Add signature title BELOW the name
                    pdfDoc.fontSize(9)
                        .font('Helvetica')
                        .fillColor('#666')
                        .text(title, sig2X, currentY, {
                            width: signatureWidth,
                            align: 'center'
                        });
                    sig2Height.title = 12;
                    currentY += 12;

                    pdfDoc.fillColor('#000');
                    sig2Height.total = currentY - rowStartY;
                }

                // Move to next row - use the maximum height of both signatures
                const maxHeight = Math.max(sig1Height.total, sig2Height.total);
                pdfDoc.y = rowStartY + maxHeight + 10;

                // Add spacing between rows if more signatures
                if (i + 2 < numSignatures) {
                    pdfDoc.moveDown(1);
                }
            }

            // eslint-disable-next-line no-console
            console.log(`  ✅ Signatures added to PDF`);
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
