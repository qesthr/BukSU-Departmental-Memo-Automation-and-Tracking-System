/* eslint-disable no-console */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const isAuthenticated = require('../middleware/isAuthenticated');

const SESSION_OPTIONS = [1, 5, 10, 15, 30, 60, 1440];

router.use(isAuthenticated);

function normalizeSettings(settings = {}) {
    return {
        darkMode: !!settings.darkMode,
        twoFactorEnabled: !!settings.twoFactorEnabled,
        sessionTimeoutMinutes: SESSION_OPTIONS.includes(settings.sessionTimeoutMinutes)
            ? settings.sessionTimeoutMinutes
            : 1440,
        notifications: {
            memoEmails: settings.notifications ? !!settings.notifications.memoEmails : true,
            profileUpdates: settings.notifications ? !!settings.notifications.profileUpdates : true
        }
    };
}

router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('settings role');
        const settings = normalizeSettings(user && user.settings);
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Settings fetch error:', error);
        res.status(500).json({ success: false, message: 'Unable to load settings' });
    }
});

router.put('/', async (req, res) => {
    try {
        const updates = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'darkMode')) {
            updates['settings.darkMode'] = !!req.body.darkMode;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'twoFactorEnabled')) {
            updates['settings.twoFactorEnabled'] = !!req.body.twoFactorEnabled;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'sessionTimeoutMinutes')) {
            const minutes = Number(req.body.sessionTimeoutMinutes);
            if (!SESSION_OPTIONS.includes(minutes)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid session timeout value'
                });
            }
            updates['settings.sessionTimeoutMinutes'] = minutes;
        }
        if (req.body.notifications && typeof req.body.notifications === 'object') {
            if (Object.prototype.hasOwnProperty.call(req.body.notifications, 'memoEmails')) {
                updates['settings.notifications.memoEmails'] = !!req.body.notifications.memoEmails;
            }
            if (Object.prototype.hasOwnProperty.call(req.body.notifications, 'profileUpdates')) {
                updates['settings.notifications.profileUpdates'] = !!req.body.notifications.profileUpdates;
            }
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({
                success: false,
                message: 'No valid settings provided'
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true, select: 'settings role' }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const settings = normalizeSettings(user.settings);
        req.user.settings = settings;

        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ success: false, message: 'Unable to update settings' });
    }
});

module.exports = router;

