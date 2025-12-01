const Memo = require('../models/Memo');
const User = require('../models/User');

/**
 * Creates a system log entry in the admin's inbox
 * This automatically logs all user activities
 */
async function createSystemLog(options) {
    try {
        const {
            activityType,  // 'memo_sent', 'password_reset', 'user_activity', etc.
            user,          // User who performed the action
            subject,       // Log subject
            content,       // Detailed content
            department,    // Related department
            metadata = {}  // Additional metadata
        } = options;

        // Find all admin users to receive the log
        const adminUsers = await User.find({ role: 'admin' }).select('_id');

        if (adminUsers.length === 0) {
            console.log('No admin users found for system logs');
            return;
        }

        // Create log entries for each admin
        const logPromises = adminUsers.map(admin => {
            return Memo.create({
                sender: user._id,
                recipient: admin._id,
                subject: subject || `System Activity: ${activityType}`,
                content: content || `${activityType} activity performed`,
                department: department || 'System',
                priority: metadata.priority || 'medium',
                status: 'sent',
                folder: 'sent',
                activityType: activityType, // Custom field for system logs
                metadata: metadata
            });
        });

        await Promise.all(logPromises);
        console.log(`System log created: ${activityType} by ${user.email}`);

    } catch (error) {
        console.error('Error creating system log:', error);
        // Don't throw - this shouldn't break the main operation
    }
}

/**
 * Log when a memo is sent
 */
async function logMemoSent(memo) {
    try {
        const sender = await User.findById(memo.sender).select('_id email');

        // Find all admin users
        const adminUsers = await User.find({ role: 'admin' }).select('_id');

        if (adminUsers.length === 0) {return;}

        // Create log entries for admins
        const logPromises = adminUsers.map(admin => {
            return Memo.create({
                sender: sender._id,
                recipient: admin._id,
                subject: `Memo Sent: ${memo.subject}`,
                content: `User ${sender.email} sent a memo to ${memo.recipient.email}. Subject: ${memo.subject}`,
                department: memo.department || 'General',
                priority: memo.priority || 'medium',
                status: 'sent',
                folder: 'sent',
                activityType: 'memo_sent',
                metadata: {
                    memoId: memo._id,
                    recipientEmail: memo.recipient.email
                }
            });
        });

        await Promise.all(logPromises);

    } catch (error) {
        console.error('Error logging memo sent:', error);
    }
}

/**
 * Log when password reset email is sent
 */
async function logPasswordReset(user, resetCode) {
    try {
        // Ensure user has _id
        if (!user || !user._id) {
            console.log('Skipping log creation: user or user._id is missing');
            return;
        }

        const adminUsers = await User.find({ role: 'admin' }).select('_id');

        if (adminUsers.length === 0) {
            console.log('No admin users found for logging');
            return;
        }

        const logPromises = adminUsers.map(admin => {
            return Memo.create({
                sender: user._id,
                recipient: admin._id,
                subject: 'Password Reset Request',
                content: `Password reset code sent to ${user.email || 'user'}. Reset code: ${resetCode}`,
                department: 'System',
                priority: 'medium',
                status: 'sent',
                folder: 'sent',
                activityType: 'password_reset',
                metadata: {
                    userEmail: user.email || '',
                    resetCode: resetCode,
                    timestamp: new Date()
                }
            });
        });

        await Promise.all(logPromises);
        console.log(`Password reset log created for ${user.email}`);

    } catch (error) {
        console.error('Error logging password reset:', error);
        // Don't throw - this should not break the main flow
    }
}

/**
 * Log when welcome email is sent
 */
async function logWelcomeEmail(user) {
    try {
        const adminUsers = await User.find({ role: 'admin' }).select('_id');

        if (adminUsers.length === 0) {return;}

        const logPromises = adminUsers.map(admin => {
            return Memo.create({
                sender: user._id,
                recipient: admin._id,
                subject: 'New User Welcome Email Sent',
                content: `Welcome email sent to new user: ${user.email} (${user.firstName} ${user.lastName})`,
                department: user.department || 'General',
                priority: 'low',
                status: 'sent',
                folder: 'sent',
                activityType: 'welcome_email',
                metadata: {
                    userEmail: user.email,
                    userName: `${user.firstName} ${user.lastName}`
                }
            });
        });

        await Promise.all(logPromises);
        console.log(`Welcome email log created for ${user.email}`);

    } catch (error) {
        console.error('Error logging welcome email:', error);
    }
}

/**
 * Log general user activities
 */
async function logUserActivity(user, activity, details = {}) {
    try {
        const adminUsers = await User.find({ role: 'admin' }).select('_id');

        if (adminUsers.length === 0) {return;}

        const logPromises = adminUsers.map(admin => {
            return Memo.create({
                sender: user._id,
                recipient: admin._id,
                subject: `User Activity: ${activity}`,
                content: `User ${user.email} (${user.firstName} ${user.lastName}) performed: ${activity}. Details: ${JSON.stringify(details)}`,
                department: user.department || 'General',
                priority: 'low',
                status: 'sent',
                folder: 'sent',
                activityType: 'user_activity',
                metadata: {
                    activity: activity,
                    details: details
                }
            });
        });

        await Promise.all(logPromises);

    } catch (error) {
        console.error('Error logging user activity:', error);
    }
}

module.exports = {
    createSystemLog,
    logMemoSent,
    logPasswordReset,
    logWelcomeEmail,
    logUserActivity
};

