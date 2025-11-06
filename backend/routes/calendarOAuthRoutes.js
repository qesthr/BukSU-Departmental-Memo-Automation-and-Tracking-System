const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const isAuthenticated = require('../middleware/isAuthenticated');
const User = require('../models/User');
const calendarService = require('../services/calendarService');

// Start OAuth flow for Calendar
router.get('/auth', isAuthenticated, (req, res) => {
    const oauth2 = calendarService.createOAuthClient();
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ];
    const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes });
    return res.redirect(url);
});

// OAuth callback for Calendar
router.get('/auth/callback', isAuthenticated, async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) { return res.status(400).send('Missing code'); }
        const oauth2 = calendarService.createOAuthClient();
        const { tokens } = await oauth2.getToken(code);
        const updates = {
            calendarAccessToken: tokens.access_token,
            calendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
        };
        if (tokens.refresh_token) { updates.calendarRefreshToken = tokens.refresh_token; }
        await User.findByIdAndUpdate(req.user._id, updates);
        // Redirect based on user role
        const redirectPath = req.user.role === 'secretary' ? '/secretary/calendar' : '/calendar';
        return res.redirect(redirectPath);
    } catch {
        return res.status(500).send('Calendar authorization failed');
    }
});

// Events proxy endpoints (server-side)
router.get('/events', isAuthenticated, async (req, res) => {
    try {
        const { timeMin, timeMax } = req.query;
        const items = await calendarService.listEvents(req.user, { timeMin, timeMax });
        return res.json(items);
    } catch {
        return res.status(500).json({ message: 'Failed to load calendar events' });
    }
});

router.post('/events', isAuthenticated, async (req, res) => {
    try {
        const { title, description, startISO, endISO, category } = req.body || {};
        const data = await calendarService.addEvent(req.user, { title, description, startISO, endISO, category });
        return res.json(data);
    } catch {
        return res.status(500).json({ message: 'Failed to add calendar event' });
    }
});

router.delete('/events/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const data = await calendarService.deleteEvent(req.user, id);
        return res.json(data);
    } catch {
        return res.status(500).json({ message: 'Failed to delete calendar event' });
    }
});

// Disconnect Google Calendar
router.delete('/disconnect', isAuthenticated, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $unset: {
                calendarAccessToken: 1,
                calendarRefreshToken: 1,
                calendarTokenExpiry: 1
            }
        });
        return res.json({ success: true, message: 'Google Calendar disconnected' });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to disconnect calendar' });
    }
});

module.exports = router;


