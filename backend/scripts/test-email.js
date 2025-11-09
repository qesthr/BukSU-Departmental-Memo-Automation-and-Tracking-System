// Email Configuration Test Script
// Run this with: npm run test:email

require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmailConfiguration() {
    console.log('=== EMAIL CONFIGURATION TEST ===\n');

    // Check environment variables
    console.log('Environment Variables:');
    console.log('SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
    console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'NOT SET');
    console.log('SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
    console.log('SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
    console.log('MAIL_FROM:', process.env.MAIL_FROM || 'NOT SET');
    console.log('');

    // Test email service
    console.log('Testing email service...');

    try {
        const testResult = await emailService.sendPasswordResetCode(
            'joenil.root@gmail.com', // Send to yourself for testing
            '123456',
            { firstName: 'Test', lastName: 'User' }
        );

        console.log('Email test result:', testResult);

        if (testResult.success) {
            console.log('✅ Email sent successfully!');
            console.log('Check your inbox for the test email.');
        } else {
            console.log('❌ Email sending failed:', testResult.message);
            if (testResult.resetCode) {
                console.log('Reset code (for testing):', testResult.resetCode);
            }
        }

    } catch (error) {
        console.error('❌ Error testing email:', error.message);
    }

    console.log('\n=== TEST COMPLETE ===');
}

// Run the test
testEmailConfiguration().catch(console.error);


