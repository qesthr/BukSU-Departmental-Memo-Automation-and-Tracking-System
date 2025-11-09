# Google Drive Integration Setup Guide

This guide will help you set up Google Drive API integration for automatic memo backup in Memofy.

## Overview

The Memofy system can automatically backup memos to Google Drive. When a Secretary or Admin creates a memo, it will be automatically saved to a "Memofy" folder in their Google Drive as a Google Docs document.

## Prerequisites

1. A Google Cloud Project with Drive API enabled
2. OAuth 2.0 credentials (Client ID and Client Secret)
3. Node.js and npm installed

## Step 1: Enable Google Drive API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Drive API"
5. Click **Enable**

## Step 2: Create OAuth 2.0 Credentials

1. In the Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **External** user type (or Internal if using Google Workspace)
   - Fill in the required information:
     - App name: **Memofy**
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `../auth/drive.file`
   - Add test users (your Google account email)
4. Create **OAuth client ID**:
   - Application type: **Web application**
   - Name: **Memofy Web Client**
   - Authorized redirect URIs:
     - `http://localhost:5000/api/drive/callback` (for development)
     - `https://yourdomain.com/api/drive/callback` (for production)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

## Step 3: Configure Environment Variables

Add the following environment variables to your `.env` file:

```env
# Google Drive API Configuration
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5000/api/drive/callback

# Optional: Use existing Google Drive folder
# Extract the folder ID from your folder URL: https://drive.google.com/drive/folders/FOLDER_ID
# Example: GOOGLE_DRIVE_FOLDER_ID=1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

For production, update the redirect URI:

```env
GOOGLE_DRIVE_REDIRECT_URI=https://yourdomain.com/api/drive/callback
```

### Using an Existing Google Drive Folder

If you already have a folder in Google Drive where you want to store all memos, you can configure it:

1. **Get the Folder ID** from your folder's URL:

   - Your folder URL: `https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L`
   - Folder ID: `1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L`

2. **Set it in your `.env` file**:

   ```env
   GOOGLE_DRIVE_FOLDER_ID=1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
   ```

   OR

3. **Set it via API** (after connecting Google Drive as admin):

   ```bash
   POST /api/drive/folder
   Body: { "folderId": "1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L" }
   ```

4. **Or check current folder configuration**:
   ```bash
   GET /api/drive/folder
   ```

## Step 4: Install Dependencies

The required package (`googleapis`) has already been installed. If you need to reinstall:

```bash
npm install googleapis
```

## Step 5: Connect Google Drive (Admin Only)

### For Admins Only:

**Important**: Only system administrators can connect Google Drive. Once connected by an admin, all memos created by Secretaries and Admins will be automatically backed up to the same shared folder.

1. Log in to Memofy as an Admin
2. Navigate to Admin Settings
3. Click "Connect Google Drive" button
4. Authorize Memofy to access your Google Drive
5. A "Memofy" folder will be created in your Google Drive
6. All memos will now be automatically backed up to this shared folder!

### API Endpoints:

- **Get authorization URL** (Admin only): `GET /api/drive/authorize`
- **OAuth callback**: `GET /api/drive/callback`
- **Check connection status**: `GET /api/drive/status`
- **Disconnect Google Drive** (Admin only): `DELETE /api/drive/disconnect`

## How It Works

1. **Admin Connection**: An admin connects their Google Drive account to Memofy
2. **Authorization**: Admin grants Memofy permission to create and manage files in their Google Drive
3. **Token Storage**: Google issues a refresh token which is securely stored system-wide (all admins/secretaries share the same connection)
4. **Shared Folder**: A single "Memofy" folder is created in the admin's Google Drive
5. **Auto-Backup**: Every time a memo is created by any Secretary or Admin, it's automatically uploaded to this shared "Memofy" folder
6. **Memo Format**: Memos are saved as Google Docs with a formatted structure including:
   - Subject
   - From/To information
   - Department
   - Priority
   - Date
   - Full content

### Key Features:

- **One Folder for All**: All memos from all users go to the same "Memofy" folder
- **Admin-Only Setup**: Only admins can connect/disconnect Google Drive
- **Automatic Backup**: Works automatically for all Secretaries and Admins once connected
- **System-Wide**: The connection is shared across all users

## Folder Structure

When an admin connects Google Drive, a folder named **"Memofy"** will be created in the admin's Google Drive root. **All memos** from all Secretaries and Admins will be saved here with the naming pattern:

```
[Subject] - [YYYY-MM-DD].docx
```

**Note**: This is a single shared folder for the entire organization.

## Security & Permissions

- **Scope Used**: `https://www.googleapis.com/auth/drive.file`
  - This is a limited scope that only allows access to files created by the application
  - Memofy cannot access or modify any other files in your Google Drive
- **Token Storage**: Refresh tokens are encrypted and stored system-wide in MongoDB
- **Shared Access**: All memos from all users are backed up to one admin-managed Google Drive folder
- **Admin Control**: Only admins can connect, disconnect, or manage the Google Drive integration

## Troubleshooting

### Error: "User has not connected Google Drive"

- Navigate to settings and click "Connect Google Drive"
- Make sure you authorize the app with the correct permissions

### Error: "Invalid redirect URI"

- Check your `.env` file has the correct `GOOGLE_DRIVE_REDIRECT_URI`
- Ensure the redirect URI in Google Cloud Console matches exactly

### Memos not backing up

1. Check if Google Drive is connected: `GET /api/drive/status`
2. Check console logs for error messages
3. Verify the user has an internet connection
4. Ensure tokens haven't expired (they will auto-refresh)

### Token Expired

- The system automatically refreshes expired access tokens
- If this fails, the user may need to reconnect Google Drive

## Testing

To test the integration:

1. Connect Google Drive as a test user
2. Create a memo
3. Check your Google Drive for the "Memofy" folder
4. Verify the memo was saved as a Google Docs document

## Additional Notes

- The Google Drive backup happens **asynchronously** - it won't slow down memo creation
- If Google Drive backup fails, the memo is still saved in the database
- Each user has their own separate "Memofy" folder
- The system respects rate limits and handles errors gracefully

## Support

For issues or questions:

1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure Google Drive API is enabled in your project
4. Check that the redirect URI matches in both `.env` and Google Cloud Console
