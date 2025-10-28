const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    async sendInvitationEmail(email, context) {
        if (!this.transporter) {
            console.log(`Email service not available. Invitation link for ${email}: ${context.link}`);
            return { success: false, message: 'Email service not configured', link: context.link };
        }

        const mailOptions = {
            from: process.env.MAIL_FROM || {
                name: 'Memofy',
                address: process.env.SMTP_USER
            },
            to: email,
            subject: "You've been invited to join Memofy",
            html: this.generateInvitationEmailHTML(context)
        };

        const result = await this.transporter.sendMail(mailOptions);
        return { success: true, messageId: result.messageId };
    }

    generateInvitationEmailHTML({ firstName, lastName, link }) {
        return `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto;padding:24px;background:#fff;border:1px solid #eee;border-radius:8px;">
            <h2 style="margin:0 0 12px;color:#1e293b;">You've been invited to Memofy</h2>
            <p>Hi ${firstName || ''} ${lastName || ''},</p>
            <p>Your administrator has created an account for you. Click the button below to complete your registration. This link expires in 24 hours and can be used only once.</p>
            <p style="margin:24px 0;">
                <a href="${link}" style="background:#1C89E3;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;">Accept Invitation</a>
            </p>
            <p>If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="word-break:break-all;color:#334155;">${link}</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #eee;"/>
            <p style="color:#64748b;font-size:13px;">Memofy • BukSU</p>
        </div>`;
    }

    initializeTransporter() {
        try {
            // Prefer Gmail OAuth2 if configured
            if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.SMTP_USER) {
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        type: 'OAuth2',
                        user: process.env.SMTP_USER,
                        clientId: process.env.GMAIL_CLIENT_ID,
                        clientSecret: process.env.GMAIL_CLIENT_SECRET,
                        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
                    }
                });
            } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                // Fallback to basic SMTP
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: process.env.SMTP_PORT || 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            } else {
                console.warn('Email credentials not configured. Email functionality will be disabled.');
                return;
            }

            // Verify transporter configuration
            this.transporter.verify((error, success) => {
                if (error) {
                    console.error('Email transporter verification failed:', error);
                } else {
                    console.log('Email transporter ready to send emails');
                }
            });

        } catch (error) {
            console.error('Failed to initialize email transporter:', error);
        }
    }

    async sendPasswordResetCode(email, resetCode, user) {
        if (!this.transporter) {
            console.log(`Email service not available. Reset code for ${email}: ${resetCode}`);
            return {
                success: false,
                message: 'Email service not configured. Check console for reset code.',
                resetCode: resetCode
            };
        }

        try {
            const mailOptions = {
                from: process.env.MAIL_FROM || {
                    name: 'BukSU Memo System',
                    address: process.env.SMTP_USER
                },
                to: email,
                subject: 'Password Reset Code - BukSU Departmental Memo System',
                html: this.generatePasswordResetEmailHTML(resetCode, user)
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Password reset email sent to ${email}:`, result.messageId);

            // Create log entry for admin (non-blocking - don't fail if logging fails)
            try {
                const logService = require('./logService');
                logService.logPasswordReset(user, resetCode).catch(err => {
                    console.error('Failed to create log entry (non-critical):', err);
                });
            } catch (logErr) {
                console.error('Could not load log service:', logErr.message);
            }

            return {
                success: true,
                message: 'Reset code sent to your email',
                messageId: result.messageId
            };

        } catch (error) {
            console.error('Failed to send password reset email:', error);
            console.log(`Email sending failed. Reset code for ${email}: ${resetCode}`);

            return {
                success: false,
                message: 'Failed to send email. Check console for reset code.',
                resetCode: resetCode,
                error: error.message
            };
        }
    }

    generatePasswordResetEmailHTML(resetCode, user) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset - BukSU Memo System</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f4f4f4;
                    }
                    .email-container {
                        background-color: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        width: 80px;
                        height: 80px;
                        margin: 0 auto 20px;
                        background-color: #0A0E3F;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 24px;
                        font-weight: bold;
                    }
                    .title {
                        color: #0A0E3F;
                        font-size: 28px;
                        margin: 0;
                        font-weight: 600;
                    }
                    .subtitle {
                        color: #666;
                        font-size: 16px;
                        margin: 10px 0 0 0;
                    }
                    .content {
                        margin-bottom: 30px;
                    }
                    .greeting {
                        font-size: 18px;
                        margin-bottom: 20px;
                        color: #333;
                    }
                    .reset-code-container {
                        background-color: #f8f9fa;
                        border: 2px dashed #4285f4;
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                        margin: 25px 0;
                    }
                    .reset-code {
                        font-size: 32px;
                        font-weight: bold;
                        color: #4285f4;
                        letter-spacing: 3px;
                        font-family: 'Courier New', monospace;
                        margin: 10px 0;
                    }
                    .instructions {
                        background-color: #e8f4fd;
                        border-left: 4px solid #4285f4;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                    .warning {
                        background-color: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                        color: #856404;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        color: #666;
                        font-size: 14px;
                    }
                    .button {
                        display: inline-block;
                        background-color: #4285f4;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 500;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="logo">B</div>
                        <h1 class="title">Password Reset Request</h1>
                        <p class="subtitle">BukSU Departmental Memo System</p>
                    </div>

                    <div class="content">
                        <p class="greeting">Hello ${user.firstName},</p>

                        <p>You have requested to reset your password for the BukSU Departmental Memo System. Use the reset code below to proceed with setting a new password.</p>

                        <div class="reset-code-container">
                            <p style="margin: 0 0 10px 0; font-weight: 500;">Your Reset Code:</p>
                            <div class="reset-code">${resetCode}</div>
                            <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Enter this 6-digit code on the reset page</p>
                        </div>

                        <div class="instructions">
                            <h3 style="margin: 0 0 10px 0; color: #4285f4;">How to use this code:</h3>
                            <ol style="margin: 0; padding-left: 20px;">
                                <li>Go to the password reset page</li>
                                <li>Enter the 6-digit code above</li>
                                <li>Create your new password</li>
                                <li>Log in with your new password</li>
                            </ol>
                        </div>

                        <div class="warning">
                            <strong>Important:</strong> This reset code will expire in 1 hour for security reasons. If you don't use it within this time, you'll need to request a new one.
                        </div>

                        <p>If you did not request this password reset, please ignore this email. Your account remains secure.</p>
                    </div>

                    <div class="footer">
                        <p>This is an automated message from the BukSU Departmental Memo System.</p>
                        <p>Please do not reply to this email.</p>
                        <p style="font-size: 12px; color: #999;">
                            BukSU - Educate. Innovate. Lead.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    async sendWelcomeEmail(email, user) {
        if (!this.transporter) {
            console.log(`Email service not available. Welcome email for ${email} not sent.`);
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const mailOptions = {
                from: process.env.MAIL_FROM || {
                    name: 'BukSU Memo System',
                    address: process.env.SMTP_USER
                },
                to: email,
                subject: 'Welcome to BukSU Departmental Memo System',
                html: this.generateWelcomeEmailHTML(user)
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Welcome email sent to ${email}:`, result.messageId);

            // Create log entry for admin (non-blocking - don't fail if logging fails)
            try {
                const logService = require('./logService');
                logService.logWelcomeEmail(user).catch(err => {
                    console.error('Failed to create log entry (non-critical):', err);
                });
            } catch (logErr) {
                console.error('Could not load log service:', logErr.message);
            }

            return {
                success: true,
                message: 'Welcome email sent',
                messageId: result.messageId
            };

        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return {
                success: false,
                message: 'Failed to send welcome email',
                error: error.message
            };
        }
    }

    generateWelcomeEmailHTML(user) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome - BukSU Memo System</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f4f4f4;
                    }
                    .email-container {
                        background-color: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        width: 80px;
                        height: 80px;
                        margin: 0 auto 20px;
                        background-color: #0A0E3F;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 24px;
                        font-weight: bold;
                    }
                    .title {
                        color: #0A0E3F;
                        font-size: 28px;
                        margin: 0;
                        font-weight: 600;
                    }
                    .user-info {
                        background-color: #f8f9fa;
                        border-left: 4px solid #4285f4;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="logo">B</div>
                        <h1 class="title">Welcome to BukSU!</h1>
                    </div>

                    <div class="content">
                        <p>Hello ${user.firstName},</p>
                        <p>Your account has been created in the BukSU Departmental Memo System! Your admin has assigned you the following details:</p>

                        <div class="user-info">
                            <p><strong>Role:</strong> ${user.role || 'Faculty'}</p>
                            <p><strong>Department:</strong> ${user.department || 'General'}</p>
                            <p><strong>Email:</strong> ${user.email}</p>
                        </div>

                        <p><strong>To access your account:</strong></p>
                        <ol>
                            <li>Go to the login page</li>
                            <li>Click "Continue with Google"</li>
                            <li>Use this email: <strong>${user.email}</strong></li>
                            <li>You'll be automatically assigned to your department and role</li>
                        </ol>

                        <p>Once logged in, you can start managing departmental memos and communicating with your department.</p>

                        <p>Thank you!</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = new EmailService();
