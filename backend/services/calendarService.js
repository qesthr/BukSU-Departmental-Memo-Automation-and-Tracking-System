const { google } = require('googleapis');
const User = require('../models/User');

function createOAuthClient() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5000/calendar/auth/callback';
    if (!clientId || !clientSecret) { throw new Error('Missing Google Calendar OAuth env'); }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function getAuthenticatedClient(user) {
    const oauth2 = createOAuthClient();
    if (user.calendarAccessToken) {
        oauth2.setCredentials({
            access_token: user.calendarAccessToken,
            refresh_token: user.calendarRefreshToken,
            expiry_date: user.calendarTokenExpiry ? user.calendarTokenExpiry.getTime() : undefined
        });
    } else if (user.calendarRefreshToken) {
        oauth2.setCredentials({ refresh_token: user.calendarRefreshToken });
    }
    oauth2.on('tokens', async (tokens) => {
        try {
            const updates = {};
            if (tokens.access_token) { updates.calendarAccessToken = tokens.access_token; }
            if (tokens.refresh_token) { updates.calendarRefreshToken = tokens.refresh_token; }
            if (tokens.expiry_date) { updates.calendarTokenExpiry = new Date(tokens.expiry_date); }
            if (Object.keys(updates).length > 0) {
                await User.findByIdAndUpdate(user._id, updates);
            }
        } catch {}
    });
    return oauth2;
}

async function listEvents(user, { timeMin, timeMax }) {
    // Only fetch Google Calendar events if user has connected their calendar
    if (!user.calendarAccessToken && !user.calendarRefreshToken) {
        console.log(`📅 Google Calendar not connected for user ${user.email}`);
        return [];
    }

    try {
        const auth = await getAuthenticatedClient(user);
        const calendar = google.calendar({ version: 'v3', auth });
        console.log(`📅 Fetching Google Calendar events for user: ${user.email}`);
        const resp = await calendar.events.list({ calendarId: 'primary', timeMin, timeMax, singleEvents: true, orderBy: 'startTime' });
        const events = resp.data.items || [];
        console.log(`📅 Found ${events.length} Google Calendar events for user ${user.email}`);
        return events;
    } catch (error) {
        console.error(`❌ Error fetching Google Calendar events for user ${user.email}:`, error.message);
        return [];
    }
}

async function addEvent(user, { title, description, startISO, endISO, category }) {
    const auth = await getAuthenticatedClient(user);
    const calendar = google.calendar({ version: 'v3', auth });
    const resp = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
            summary: title,
            description,
            start: { dateTime: startISO },
            end: { dateTime: endISO },
            extendedProperties: { private: { category: String(category || 'standard') } }
        }
    });
    return resp.data;
}

async function deleteEvent(user, eventId) {
    const auth = await getAuthenticatedClient(user);
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return { ok: true };
}

module.exports = { createOAuthClient, getAuthenticatedClient, listEvents, addEvent, deleteEvent };


