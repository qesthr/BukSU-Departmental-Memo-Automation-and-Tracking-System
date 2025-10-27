# Quick Guide: Connect Google Drive

## Why Your Memos Aren't Going to Google Drive

**The system is not authorized to access Google Drive yet!**

Even though you have:

- ✓ Environment variables configured
- ✓ Folder ID set: `1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L`

The system still needs **an admin to authorize** Google Drive access.

## How to Connect (5 Steps)

### Step 1: Make Sure You're Logged In as Admin

1. Open your Memofy application
2. Log in with an **Admin account**
3. Keep this browser open

### Step 2: Open the Authorization URL

While logged in as an admin, visit this URL:

```
http://localhost:5000/api/drive/authorize
```

(Replace `localhost:5000` with your actual server address if different)

### Step 3: Authorize Google Drive

1. You'll be redirected to Google's authorization page
2. Select your Google account (the one that owns the folder `1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L`)
3. Click "Allow" or "Continue" to grant permissions

### Step 4: Wait for Confirmation

1. You'll see a "✓ Google Drive Connected!" message
2. Close the tab/window
3. You're done!

### Step 5: Test It

1. Create a new memo in the system
2. Wait 10-30 seconds
3. Check your Google Drive folder: https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
4. You should see a new file like "Memo Subject - 2025-01-15.docx"

## Troubleshooting

### "Authorization Error" or "Invalid Redirect URI"

Make sure in your `.env` file:

```env
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5000/api/drive/callback
```

Matches what you set in Google Cloud Console.

### "Access Denied" or "403 Error"

- Make sure you're logged in as an **Admin**
- Make sure you're logged into the correct Google account that owns the folder
- Re-try the authorization process

### After Connecting, Memos Still Not Appearing

1. **Check server console** - You should see: `Memo backed up to Google Drive: [file_id]`
2. **Check for errors** - Look for any red error messages in console
3. **Verify folder ID** - Run the diagnostic: `node check-gdrive-status.js`

### Want to Check Connection Status?

**Via Browser/API:**

```
GET http://localhost:5000/api/drive/status
```

**Via Script:**

```bash
node check-gdrive-status.js
```

## Once Connected

✅ All memos created by Secretaries and Admins will automatically backup to Google Drive
✅ Files saved as Google Docs in your folder: `Memofy_Backup_Storage`
✅ Works silently in the background - no action needed!

## Disconnect or Reconnect

**To disconnect:**

```
DELETE http://localhost:5000/api/drive/disconnect
```

**To reconnect:**
Just visit `/api/drive/authorize` again!

---

**Need help?** Check the server console for detailed error messages!
