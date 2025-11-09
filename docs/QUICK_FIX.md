# Quick Fix: Connect Google Drive

## The Error You're Seeing

```json
{ "success": false, "message": "Not authenticated" }
```

This means you're not logged into Memofy!

## Simple 4-Step Solution

### Step 1: Log In to Memofy

1. Open: http://localhost:5000 (or your server URL)
2. **Log in** with your Admin account
3. Verify you see the admin dashboard

### Step 2: While Still Logged In, Open New Tab

Keep the Memofy tab open, open a **new browser tab**.

### Step 3: Visit This URL

**In the new tab**, type this URL (or click if you can copy it):

```
http://localhost:5000/api/drive/authorize
```

### Step 4: Click Allow on Google

1. You'll see Google's authorization page
2. Select your Google account
3. Click **"Allow"**
4. You'll see: "✓ Google Drive Connected!"

### Step 5: Test It

1. Go back to Memofy
2. Create a test memo
3. Check your Google Drive folder (you'll see it appear!)

---

## Why This Happens

The `/api/drive/authorize` endpoint is **protected** - you must be logged in as an admin. This prevents unauthorized access.

---

## Need Help?

Check the server console when you create a memo. You should see:

**Before connecting:**

```
[Google Drive] NOT connected - memo will NOT be backed up
```

**After connecting:**

```
[Google Drive] Connection status: true
✓ Memo backed up to Google Drive: [file_id]
```
