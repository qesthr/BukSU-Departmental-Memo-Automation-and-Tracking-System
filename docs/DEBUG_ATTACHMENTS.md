# Debugging Attachment Issues

## Problem

Attachments array is empty in database: `attachments: Array (empty)`

This means files are not being uploaded properly.

## Steps to Debug

### Step 1: Create a Memo with an Image

1. Go to Compose
2. Fill in all fields
3. **Select an image file** (click Browse/Choose File)
4. **Click Send**

### Step 2: Check Server Console

You should see these messages:

**If files ARE uploaded:**

```
Processing 1 uploaded file(s)...
Attachment 1: { filename: 'photo.jpg', path: 'uploads/1234567890-photo.jpg', size: 12345, mimetype: 'image/jpeg' }
Total attachments to save: 1
Memo before save: { subject: '...', attachmentsCount: 1, attachments: [...] }
Memo after save - ID: [...]
Saved attachments: [ { filename: 'photo.jpg', ... } ]
```

**If files are NOT uploaded:**

```
Processing 0 uploaded file(s)...
Total attachments to save: 0
Memo before save: { subject: '...', attachmentsCount: 0, attachments: [] }
```

### Step 3: If You See "0 uploaded file(s)"

This means the files aren't reaching the server. Check:

1. **Browser Console** (F12) - Look for errors when clicking Send
2. **Are files selected?** - Check the file input shows files are selected
3. **Form submission** - Is the form being submitted properly?

### Common Issues

#### Issue 1: Files Not Being Sent

**Symptom**: Console shows "0 uploaded file(s)"

**Possible causes:**

- File input not working
- Form not submitting files
- JavaScript error preventing upload

**Solution**:

- Open browser console (F12)
- Look for errors
- Check Network tab - is the POST request being made?

#### Issue 2: Files Being Sent But Not Saved

**Symptom**: Console shows files processed but attachments empty in database

**Possible causes:**

- MongoDB not saving attachments field
- Schema validation failing
- File path issues

**Check**:

- Look for MongoDB errors in console
- Verify memo is actually being saved

#### Issue 3: Multer Not Working

**Symptom**: No file processing logs at all

**Check**:

- Is multer middleware installed? (`npm list multer`)
- Is the upload middleware configured correctly?
- Are there errors in server console on startup?

## What to Report

When testing, please share:

1. Console output (the entire output when you create a memo)
2. Whether files appear selected in the file input
3. Any errors in browser console (F12)
4. Whether the memo is created successfully (but without attachments)

## Quick Test

1. Create a test memo WITHOUT attachments
2. Verify it saves to database
3. Then create a memo WITH an image
4. Check console output
5. Share what you see!
