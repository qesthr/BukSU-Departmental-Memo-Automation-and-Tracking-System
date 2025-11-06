# Google Drive Attachment Support

## ✅ Now Supports File Attachments!

When you create a memo with attachments (images, PDFs, documents), they are now **automatically backed up to Google Drive** along with the memo!

## How It Works

### What Gets Uploaded

When you compose a memo with attachments:

1. **The memo** is saved as a Google Docs document (text format)
2. **Each attachment** is uploaded as a separate file in the same folder

### File Structure in Google Drive

```
Memofy_Backup_Storage/
├── Memo Subject - 2025-01-15 (Google Docs)
├── image1.jpg
├── image2.png
├── document.pdf
└── attachment.docx
```

### Uploaded Files

- **Google Docs file**: Contains memo text with attachment list
- **Original files**: Images, PDFs, and documents uploaded separately
- **Preserve names**: Original filenames are kept
- **Same folder**: Everything goes to your designated "Memofy_Backup_Storage" folder

## Supported Attachment Types

- ✅ **Images**: JPEG, PNG, GIF, WebP
- ✅ **Documents**: PDF, Word (.doc, .docx), Text files
- ✅ **Multiple files**: Upload up to 10 files per memo
- ✅ **Size limit**: 10MB per file

## What You'll See in Google Drive

### The Memo Document

A Google Docs file containing:

```
MEMO

Subject: Your Subject
From: John Doe (john@example.com)
To: Jane Smith (jane@example.com)
Department: IT/EMC
Priority: medium
Date: 1/15/2025, 10:30:00 AM

─────────────────────────────────

Your memo content here...

─────────────────────────────────
Attachments (3):
- photo.jpg (156789 bytes)
- document.pdf (245678 bytes)
- file.docx (123456 bytes)
```

### The Actual Files

Your uploaded images and files appear as separate files in the same folder, exactly as you uploaded them.

## Console Logging

When you create a memo with attachments, you'll see in the server console:

```
[Google Drive] Connection status: true
[Google Drive] Attempting to upload memo: Test Memo
✓ Uploaded attachment: photo.jpg
✓ Uploaded attachment: document.pdf
✓ Memo backed up to Google Drive: [file_id]
  Memo: Test Memo
```

If any attachment fails to upload, you'll see:

```
✓ Uploaded attachment: photo.jpg
✗ Failed to upload attachment document.pdf: [error message]
✓ Memo backed up to Google Drive: [file_id]
```

**Note**: Even if attachment upload fails, the memo itself will still be backed up.

## Troubleshooting

### Images Not Appearing in Google Drive

**Check server console** for errors starting with `✗ Failed to upload attachment`

**Common issues:**

- File path not found
- File size exceeds limit
- Internet connection issues
- Google Drive API errors

**Solutions:**

- Check that files were uploaded to the server's `/uploads` folder
- Verify file size is under 10MB
- Check internet connection
- Check Google Drive API quota/limits

### File Too Large

**Error**: File exceeds 10MB limit

**Solution**:

- Compress images before uploading
- Use smaller file sizes
- Split large documents

### Partial Upload

If some files upload but others don't:

- Check console for which files failed
- Common causes: file format not supported, file corrupted
- The memo document will still be created with a list of all attachments

## Best Practices

1. **Image sizes**: Keep images under 5MB for faster upload
2. **File names**: Use descriptive names (files keep original names)
3. **Multiple files**: Upload all related files in one memo
4. **Testing**: Create a test memo to verify attachments are working

## Summary

✅ **Attachments are supported**
✅ **Automatically uploaded to Google Drive**
✅ **Original filenames preserved**
✅ **Same folder as memos**
✅ **Non-blocking**: Memo uploads even if some attachments fail

Your images and files are now safely backed up to Google Drive along with your memos! 🎉
