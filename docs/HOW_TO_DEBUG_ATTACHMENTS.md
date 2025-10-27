# How to Debug Why Images Aren't Being Saved

## The Issue

You're seeing "Created PDF with 0 embedded images" which means `memo.attachments` is empty.

## Debug Steps

### Step 1: Create a Test Memo with Image

1. Fill in the form:
   - To: [any email]
   - Subject: "Test with Image"
   - Content: "Testing image upload"
   - **Select an image file** in the Attachments field
2. Click "Send"

### Step 2: Check Server Console Output

You should see one of these scenarios:

#### Scenario A: Files ARE Being Processed

```
=== MEMO CREATE DEBUG ===
Request body: { recipientEmail: '...', subject: '...', ... }
req.files exists? true
req.files type: object
req.files length: 1
req.files: [ { filename: 'photo.jpg', path: 'uploads/...', ... } ]
========================
Processing 1 uploaded file(s)...
Attachment 1: { filename: 'photo.jpg', path: 'uploads/...', size: 12345, ... }
Total attachments to save: 1
Memo before save: { attachmentsCount: 1, ... }
```

#### Scenario B: Files are NOT Being Processed

```
=== MEMO CREATE DEBUG ===
req.files exists? false    ← OR true
req.files length: 0        ← This is the problem
req.files: undefined       ← or []
========================
No files detected in req.files
Total attachments to save: 0
```

### Step 3: What the Output Tells Us

- **If `req.files.length: 0`** → Multer is receiving the request but files aren't being uploaded
- **If `req.files exists? false`** → Multer middleware isn't running
- **If files are processed but not saved** → Database save issue

## Likely Causes

### Cause 1: Files Not Being Sent from Frontend

**Check:**

- Browser console (F12)
- Network tab - is the FormData being sent?
- Is the form submission working?

### Cause 2: Multer Middleware Issue

**Check:**

- Is the route configured with multer? (`backend/routes/logRoutes.js`)
- Is multer installed? (`npm list multer`)

### Cause 3: File Path Issues

**Check:**

- Does `/uploads` folder exist?
- Are files being saved there?
- Check server logs for multer errors

## Next Steps

After you create a memo with an image, **share the console output** from "=== MEMO CREATE DEBUG ===" and I'll tell you exactly what's wrong!
