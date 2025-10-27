# Troubleshooting: PDF Not Appearing in Google Drive

## Check Your Server Console

When you create a memo, **watch the server console** for these messages:

### ✅ Success Messages

```
[Google Drive] Connection status: true
[Google Drive] Attempting to upload memo: Test Memo
  Creating PDF file...
  PDF created, uploading to Google Drive...
  PDF uploaded successfully, cleaning up...
  ✓ Created PDF with 2 embedded images
  ✓ PDF uploaded to Google Drive: [file_id]
✓ Memo backed up to Google Drive: [file_id]
  Memo: Test Memo
```

### ❌ Error Messages to Look For

#### 1. "NOT connected"

```
[Google Drive] Connection status: false
[Google Drive] NOT connected - memo will NOT be backed up
```

**Solution**: Connect Google Drive at `/api/drive/authorize`

#### 2. "Google Drive has not been connected"

```
Error: Google Drive has not been connected to the system
```

**Solution**: An admin needs to authorize Google Drive first

#### 3. "Error creating PDF"

```
✗ Error uploading memo to Google Drive: ...
```

**Solution**: Check the error details - might be PDF creation issue

#### 4. "Token expired"

```
Token expired, refreshing...
```

**Solution**: This is normal - system auto-refreshes tokens

## Step-by-Step Debugging

### Step 1: Check Connection Status

Run this command:

```bash
node backend/scripts/checkDriveStatus.js
```

**Expected output if connected:**

```
Google Drive Connected: ✓ YES
```

**If it shows NO**, you need to connect first!

### Step 2: Create a Test Memo

1. Log in to Memofy
2. Click "Compose"
3. Fill in a test memo (add an image if you want)
4. **Watch the server console immediately**

### Step 3: Check Console Output

Look for these specific messages:

**If you see:**

```
[Google Drive] Connection status: false
```

→ Google Drive is NOT connected. Connect it first.

**If you see:**

```
[Google Drive] Connection status: true
Creating PDF file...
```

→ PDF is being created. Continue watching...

**If you see:**

```
✗ Error uploading memo to Google Drive: ...
```

→ There's an error. Check the error message.

**If you see:**

```
✓ PDF uploaded to Google Drive: [file_id]
```

→ SUCCESS! PDF should be in Google Drive now.

### Step 4: Wait and Check Google Drive

After seeing success message:

1. **Wait 10-30 seconds** (upload takes time)
2. **Refresh your Google Drive folder**
3. **Look for the PDF file**

**Check here:**
https://drive.google.com/drive/u/0/folders/1XoY3mVtdaneUOdA0jxnI_cLKSOL3JQ_L

## Common Issues and Solutions

### Issue 1: Connection Status False

**Symptom**: `[Google Drive] Connection status: false`

**Cause**: Google Drive not connected

**Solution**:

1. Visit: http://localhost:5000/api/drive/authorize (while logged in as admin)
2. Complete OAuth flow
3. Try creating memo again

### Issue 2: PDF Creation Error

**Symptom**: `✗ Error uploading memo to Google Drive: ...`

**Possible causes:**

- PDFKit not installed properly
- Out of disk space
- Permission issues with `/uploads` folder

**Solution**:

```bash
# Reinstall pdfkit
npm uninstall pdfkit
npm install pdfkit

# Check permissions
chmod -R 755 uploads
```

### Issue 3: Token Expired

**Symptom**: `Error: Token expired`

**Cause**: Access token expired

**Solution**: System should auto-refresh, but if it fails:

1. Disconnect Google Drive
2. Reconnect it
3. Try again

### Issue 4: Folder Not Found

**Symptom**: `Error: Folder not found`

**Cause**: Folder ID is incorrect or folder was deleted

**Solution**:

1. Check your folder exists in Google Drive
2. Update the folder ID in `.env` or via API
3. Try again

### Issue 5: No Console Output

**Symptom**: No messages in console at all

**Cause**: Something is preventing the code from running

**Solutions**:

- Check that server is running
- Check that you're logged in
- Check that memo was actually created
- Look for any uncaught errors

## Quick Diagnostic Test

Run these steps in order:

1. **Check if connected**:

   ```bash
   node backend/scripts/checkDriveStatus.js
   ```

2. **Create a simple test memo** (no attachments first):

   - Subject: "Test PDF Upload"
   - Content: "This is a test"
   - Send it

3. **Watch console** for the messages above

4. **Check Google Drive** after 30 seconds

5. **If it worked**: Try with an image attachment
6. **If it didn't work**: Copy the error message and check this guide

## Still Not Working?

If PDF still doesn't appear after all the above:

1. **Check server logs** for any unhandled errors
2. **Verify Google Drive folder exists** and is accessible
3. **Try disconnecting and reconnecting** Google Drive
4. **Check internet connection** during upload
5. **Verify file size** - very large images might cause timeouts

## Success Indicators

✅ **PDF appears** in Google Drive folder
✅ **PDF is downloadable** and opens correctly
✅ **Images are embedded** inside the PDF
✅ **Console shows success** messages
✅ **File name** matches: `[Subject] - [Date].pdf`

If you see all of these, it's working! 🎉
