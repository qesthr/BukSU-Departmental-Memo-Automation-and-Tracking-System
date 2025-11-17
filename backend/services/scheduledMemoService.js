/**
 * Scheduled Memo Service
 * Handles sending of scheduled memos when their scheduledSendAt time arrives
 */

const Memo = require('../models/Memo');
const User = require('../models/User');
const notificationService = require('./notificationService');

/**
 * Process and send scheduled memos that are due
 */
async function processScheduledMemos() {
    try {
        const now = new Date();

        // Find all memos with status 'scheduled' and scheduledSendAt <= now
        const scheduledMemos = await Memo.find({
            status: 'scheduled',
            scheduledSendAt: { $lte: now }
        }).populate('sender', 'email firstName lastName')
          .populate('recipient', 'email firstName lastName')
          .lean();

        if (scheduledMemos.length === 0) {
            return { processed: 0, errors: [] };
        }

        console.log(`📅 Processing ${scheduledMemos.length} scheduled memo(s)...`);

        const errors = [];
        let processed = 0;

        for (const memo of scheduledMemos) {
            try {
                // Update memo status to 'sent' and move to 'sent' folder
                await Memo.findByIdAndUpdate(memo._id, {
                    status: 'sent',
                    folder: 'sent',
                    scheduledSendAt: null // Clear scheduled date
                });

                // Send notification to recipient
                await notificationService.notifyRecipients({
                    memo: {
                        ...memo,
                        status: 'sent'
                    },
                    actor: memo.sender
                });

                processed++;
                console.log(`✅ Sent scheduled memo: ${memo.subject} (ID: ${memo._id})`);
            } catch (error) {
                console.error(`❌ Error processing scheduled memo ${memo._id}:`, error.message);
                errors.push({ memoId: memo._id, error: error.message });
            }
        }

        if (processed > 0) {
            console.log(`✅ Successfully sent ${processed} scheduled memo(s)`);
        }

        return { processed, errors };
    } catch (error) {
        console.error('❌ Error in processScheduledMemos:', error);
        return { processed: 0, errors: [{ error: error.message }] };
    }
}

/**
 * Start the scheduled memo processor
 * Runs every minute to check for scheduled memos that need to be sent
 */
function startScheduledMemoProcessor() {
    // Process immediately on startup (in case server was down)
    processScheduledMemos().catch(err => {
        console.error('Error in initial scheduled memo processing:', err);
    });

    // Then run every minute
    setInterval(() => {
        processScheduledMemos().catch(err => {
            console.error('Error in scheduled memo processing:', err);
        });
    }, 60000); // 60 seconds = 1 minute

    console.log('📅 Scheduled memo processor started (checking every minute)');
}

module.exports = {
    processScheduledMemos,
    startScheduledMemoProcessor
};

