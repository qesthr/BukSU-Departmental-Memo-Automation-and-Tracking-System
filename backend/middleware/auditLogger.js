const { createSystemLog } = require('../services/logService');

// Non-blocking audit logger for security-relevant events
// Memo.activityType has a strict enum; normalize to 'user_activity' and include original type in metadata
async function audit(user, activityType, subject, content, metadata = {}) {
	try {
		if (!user || !user._id) return; // require valid sender id for Memo schema
		await createSystemLog({
			activityType: 'user_activity',
			user,
			subject,
			content,
			department: user.department || 'System',
			metadata: { originalActivityType: activityType, ...metadata }
		});
	} catch (e) {
		// Do not throw; avoid breaking main flow
		console.error('audit logger error:', e);
	}
}

module.exports = { audit };


