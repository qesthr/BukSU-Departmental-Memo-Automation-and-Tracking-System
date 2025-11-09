# How to Verify Google Drive is Connected

## Quick Answer: Are Those 3 Files Safe?

**No, those 3 existing files will NOT appear in Recent Memos** because:

- They were uploaded separately (not through Memofy system)
- Google Drive is a **BACKUP destination**, not a source
- The system doesn't import files FROM Google Drive
- Recent Memos only shows memos created within the Memofy system

## Understanding the Data Flow

```
📝 Create Memo in Memofy System
           ↓
    💾 Saved to Database
           ↓
    📊 Shows in "Recent Memos"
           ↓
    ☁️ Automatically backed up to Google Drive
```

**Important**: The flow is ONE-WAY (Memofy → Google Drive), NOT two-way.

## How to Verify Connection

### Method 1: Check Status via API

**Endpoint**: `GET /api/drive/status`

**Response if connected**:

```json
{
  "success": true,
  "connected": true
}
```

**Response if NOT connected**:

```json
{
  "success": true,
  "connected": false
}
```

### Method 2: Test by Creating a Memo

The best way to verify is to create a test memo:

1. **Create a new memo** in the Memofy system (as Secretary or Admin)
2. **Wait a few seconds** for the background backup
3. **Check your Google Drive folder**: https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
4. **You should see** a new file appear like: "Test Memo - 2025-01-15.docx"

### Method 3: Check Server Logs

When a memo is successfully backed up, you'll see in server console:

```
Memo backed up to Google Drive: [file_id]
```

## Setup Status Checklist

- [ ] Google Drive API credentials added to `.env`
- [ ] Admin has connected Google Drive account
- [ ] Folder ID configured (or using auto-created folder)
- [ ] Can create memos in the system
- [ ] New memos appear in Google Drive folder

## Troubleshooting

### If Google Drive is NOT Connected:

1. **An admin needs to connect**:

   - Go to Admin Dashboard → Settings
   - Click "Connect Google Drive"
   - Authorize the application

2. **Check environment variables**:
   ```env
   GOOGLE_DRIVE_CLIENT_ID=...
   GOOGLE_DRIVE_CLIENT_SECRET=...
   GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5000/api/drive/callback
   ```

### If Connected But Memos Not Backing Up:

1. Check server console for errors
2. Verify folder ID is set correctly
3. Check that the connected Google account has permission
4. Try creating a new memo

## What About Those 3 Existing Files?

Those files in your Google Drive folder are:

- ✅ Safe and will remain there
- ✅ Not affected by Memofy system
- ✅ Not imported or synchronized
- ✅ Only NEW memos will be backed up to that folder

The folder is now a shared storage location where:

- Old files (your 3 files) = remain untouched
- New memos = automatically backed up here

## Summary

| Item                     | In Recent Memos? | In Google Drive?          |
| ------------------------ | ---------------- | ------------------------- |
| Old files (your 3 files) | ❌ No            | ✅ Yes                    |
| Memos created in Memofy  | ✅ Yes           | ✅ Yes (after creation)   |
| System logs              | ✅ Yes           | ❌ No (only actual memos) |

**To verify connection**: Create a test memo and check Google Drive after a few seconds!
