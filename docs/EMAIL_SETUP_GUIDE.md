# Email Configuration Guide for BukSU Memo System

## Overview

This guide will help you configure email functionality for the forgot password system.

## Required Environment Variables

Add these to your `.env` file:

```env
# SMTP Email Configuration
SMTP_USER=joenil.root@gmail.com
SMTP_PASS=wygwachyvzxjvrbx
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
MAIL_FROM="Memo <joenil.root@gmail.com>"
```

## Gmail Setup (Recommended)

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication if not already enabled

### Step 2: Generate App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on "2-Step Verification"
3. Scroll down to "App passwords"
4. Click "App passwords"
5. Select "Mail" and "Other (Custom name)"
6. Enter "BukSU Memo System" as the name
7. Copy the generated 16-character password

### Step 3: Update .env File

```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
```

## Alternative Email Services

### Outlook/Hotmail

```env
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

### Yahoo Mail

```env
EMAIL_USER=your-email@yahoo.com
EMAIL_PASS=your-app-password
```

### Custom SMTP Server

If you have your own SMTP server, modify `backend/services/emailService.js`:

```javascript
this.transporter = nodemailer.createTransporter({
  host: "your-smtp-server.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
```

## Testing Email Configuration

### Method 1: Test with Forgot Password

1. Start your application
2. Go to the login page
3. Click "Forgot Password"
4. Enter a valid email address
5. Check if you receive the reset code email

### Method 2: Check Console Logs

Look for these messages in your console:

- ✅ "Email transporter ready to send emails" - Configuration successful
- ❌ "SMTP credentials not configured" - Missing environment variables
- ❌ "Email transporter verification failed" - Invalid credentials

### Method 3: Test Email Service Directly

Create a test script:

```javascript
const emailService = require("./backend/services/emailService");

async function testEmail() {
  const result = await emailService.sendPasswordResetCode(
    "test@example.com",
    "ABC123",
    { firstName: "Test", lastName: "User" }
  );
  console.log("Email test result:", result);
}

testEmail();
```

## Troubleshooting

### Common Issues

**1. "SMTP credentials not configured"**

- Check if SMTP_USER and SMTP_PASS are set in .env
- Restart your application after adding environment variables

**2. "Email transporter verification failed"**

- Verify your SMTP credentials are correct
- For Gmail, make sure you're using an App Password, not your regular password
- Check if 2-Factor Authentication is enabled

**3. "Failed to send password reset email"**

- Check your internet connection
- Verify the email address is valid
- Check if your email provider blocks automated emails

**4. Emails going to spam**

- Add your email to the recipient's contacts
- Check spam folder
- Consider using a professional email service

### Security Notes

- Never commit your .env file to version control
- Use App Passwords instead of regular passwords
- Consider using environment-specific email accounts
- Regularly rotate your email passwords

## Production Recommendations

### For Production Use:

1. **Use a professional email service** like SendGrid, Mailgun, or AWS SES
2. **Set up email templates** for different types of emails
3. **Implement email rate limiting** to prevent abuse
4. **Add email logging** for audit purposes
5. **Use environment-specific email accounts**

### Example Production Configuration:

```env
# Production Email Service (SendGrid)
EMAIL_SERVICE=sendgrid
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@buksu.edu.ph
```

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify your email configuration
3. Test with a simple email first
4. Check your email provider's documentation

---

**Note:** The system will work without email configuration - reset codes will be logged to the console for testing purposes.
