# Step-by-Step: Connect Google Drive

## The Problem

You're getting `{"success":false,"message":"Not authenticated"}` because you need to be **logged in** to Memofy first!

## Solution: Follow These Steps

### Step 1: Log In to Memofy

1. Open your Memofy application (e.g., http://localhost:5000)
2. **Log in** with your Admin account
3. Make sure you're logged in (you should see the admin dashboard)

### Step 2: Authorize Google Drive

**While logged in**, open a new tab and visit:

```
http://localhost:5000/api/drive/authorize
```

### Step 3: Complete OAuth Flow

1. You'll be redirected to Google's authorization page
2. Select the Google account that owns the folder `Memofy_Backup_Storage`
3. Click **"Allow"** or **"Continue"**
4. You'll see: "✓ Google Drive Connected!"
5. Close that tab

### Step 4: Verify Connection

Now when you create a memo, check the server console. You should see:

```
[Google Drive] Connection status: true
[Google Drive] Attempting to upload memo: [subject]
✓ Memo backed up to Google Drive: [file_id]
```

### Step 5: Test

1. **Send a test memo** through Memofy
2. **Wait 10-30 seconds**
3. **Check your Google Drive**: https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
4. **You should see** a new file appear!

---

## Alternative: Add a UI Button (For Later)

You could also add a "Connect Google Drive" button to the admin settings page to make this easier for users. But for now, the URL method works.

---

## Troubleshooting

### "Not authenticated"

- **Solution**: Make sure you're logged into Memofy first
- Open Memofy, log in, then visit the authorize URL

### "Access Denied"

- **Solution**: Make sure you're logged in as an **Admin**
- Regular users cannot connect Google Drive

### "Invalid Redirect URI"

- **Solution**: Check your `.env` file
- Make sure `GOOGLE_DRIVE_REDIRECT_URI` matches what's in Google Cloud Console

### Memos still not backing up after connecting

- **Check server console** for error messages
- Look for lines starting with `[Google Drive]` or `✗`
- Copy any error messages and check the documentation

---

## Quick Reference

**Connect Google Drive:**

```
http://localhost:5000/api/drive/authorize
```

(Must be logged in as admin)

**Check connection status:**

```
GET http://localhost:5000/api/drive/status
```

**Your Google Drive folder:**

```
https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L
```
