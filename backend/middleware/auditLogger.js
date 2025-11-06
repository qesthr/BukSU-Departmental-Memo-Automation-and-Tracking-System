const AuditLog = require('../models/AuditLog');

// Non-blocking audit logger for security-relevant events
// Memo.activityType has a strict enum; normalize to 'user_activity' and include original type in metadata
async function audit(user, activityType, subject, content, metadata = {}) {
	try {
		if (!user || !user._id) {return;}
		await AuditLog.create({
			user: user._id,
			email: user.email,
			action: activityType,
			subject: subject || 'User Activity',
			message: content || '',
			metadata: { ...metadata }
		});
	} catch (e) {
		// Do not throw; avoid breaking main flow
		console.error('audit logger error:', e);
	}
}

module.exports = { audit };


