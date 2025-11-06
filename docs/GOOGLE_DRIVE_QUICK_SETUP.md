# Quick Setup Guide: Use Your Existing Google Drive Folder

## Your Folder Information

**Folder Name:** Memofy_Backup_Storage
**Folder ID:** `1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L`
**Folder URL:** https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L

## How to Configure the System

The system will automatically save all memos to your existing folder once configured. You have **three options**:

### Option 1: Using Environment Variable (Recommended)

Add this to your `.env` file:

```env
GOOGLE_DRIVE_FOLDER_ID=1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
```

This way, when an admin connects their Google Drive, the system will automatically use your existing folder.

### Option 2: Using API (After Connection)

After an admin has connected their Google Drive account, use this API endpoint:

**POST** `/api/drive/folder`

**Request Body:**

```json
{
  "folderId": "1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L"
}
```

### Option 3: Let the System Create a New Folder

If you don't specify the folder ID, the system will create a new folder called "Memofy" in the admin's Google Drive. You can then move files to your preferred folder or share the folder with your existing one.

## How Memos Will Be Saved

Once configured, all memos will be automatically saved to your **Memofy_Backup_Storage** folder with this naming pattern:

```
[Subject] - [YYYY-MM-DD].docx
```

For example:

- "Faculty Meeting - 2025-01-15.docx"
- "Grade Submission Reminder - 2025-01-20.docx"

## Important Notes

1. **Shared Folder**: All memos from ALL Secretaries and Admins will be saved to this ONE folder
2. **Automatic**: Once configured, backup happens automatically - no need to do anything else
3. **Secure**: The system uses the `drive.file` scope, which only allows access to files it creates
4. **Format**: Memos are saved as Google Docs with full formatting (subject, from, to, department, priority, date, content)

## Testing

1. Configure the folder ID (Option 1 or 2)
2. Have an admin connect their Google Drive
3. Create a test memo as a Secretary or Admin
4. Check your folder: https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
5. You should see the memo as a Google Docs file!

## Troubleshooting

**If memos aren't appearing in your folder:**

1. Check that Google Drive is connected: `GET /api/drive/status`
2. Verify the folder ID is set correctly: `GET /api/drive/folder`
3. Check server console logs for any errors
4. Ensure the admin's Google Drive account has access to that folder

**To change the folder later:**
Use Option 2 (API method) to set a new folder ID, or update the `.env` file and restart the server.
