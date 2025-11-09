const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const isAuthenticated = require('../middleware/isAuthenticated');
const User = require('../models/User');
const calendarService = require('../services/calendarService');

// Start OAuth flow for Calendar
router.get('/auth', isAuthenticated, (req, res) => {
    try {
        const oauth2 = calendarService.createOAuthClient();
        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];
        const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes });
        return res.redirect(url);
    } catch (error) {
        console.error('❌ Error in /calendar/auth:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).send('Calendar authorization setup failed. Please check server configuration.');
    }
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
    } catch (error) {
        console.error('❌ Error in /calendar/auth/callback:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).send('Calendar authorization failed');
    }
});

// Events proxy endpoints (server-side)
router.get('/events', isAuthenticated, async (req, res) => {
    try {
        const { timeMin, timeMax } = req.query;

        // Validate required parameters
        if (!timeMin || !timeMax) {
            console.warn('⚠️ Missing timeMin or timeMax in /calendar/events request');
            return res.json([]); // Return empty array instead of error
        }

        // Fetch user's Google Calendar events (requires OAuth)
        const items = await calendarService.listEvents(req.user, { timeMin, timeMax });
        // calendarService.listEvents always returns an array (empty on error)
        // It also includes public holidays now
        return res.json(items || []);
    } catch (error) {
        console.error('❌ Error in /calendar/events:', error);
        console.error('Error stack:', error.stack);
        // Return empty array instead of 500 error - Google Calendar is optional
        // This prevents the calendar from breaking if Google Calendar API fails
        return res.json([]);
    }
});

router.post('/events', isAuthenticated, async (req, res) => {
    try {
        const { title, description, startISO, endISO, category } = req.body || {};
        const data = await calendarService.addEvent(req.user, { title, description, startISO, endISO, category });
        return res.json(data);
    } catch (error) {
        console.error('❌ Error in POST /calendar/events:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({
            message: 'Failed to add calendar event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.delete('/events/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const data = await calendarService.deleteEvent(req.user, id);
        return res.json(data);
    } catch (error) {
        console.error('❌ Error in DELETE /calendar/events/:id:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({
            message: 'Failed to delete calendar event',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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


