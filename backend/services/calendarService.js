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
    try {
        const oauth2 = createOAuthClient();
        if (user && user.calendarAccessToken) {
            oauth2.setCredentials({
                access_token: user.calendarAccessToken,
                refresh_token: user.calendarRefreshToken,
                expiry_date: user.calendarTokenExpiry ? user.calendarTokenExpiry.getTime() : undefined
            });
        } else if (user && user.calendarRefreshToken) {
            oauth2.setCredentials({ refresh_token: user.calendarRefreshToken });
        }
        oauth2.on('tokens', async (tokens) => {
            try {
                const updates = {};
                if (tokens.access_token) { updates.calendarAccessToken = tokens.access_token; }
                if (tokens.refresh_token) { updates.calendarRefreshToken = tokens.refresh_token; }
                if (tokens.expiry_date) { updates.calendarTokenExpiry = new Date(tokens.expiry_date); }
                if (Object.keys(updates).length > 0 && user && user._id) {
                    await User.findByIdAndUpdate(user._id, updates);
                }
            } catch (err) {
                console.error('Error updating user tokens:', err);
            }
        });
        return oauth2;
    } catch (error) {
        console.error('Error creating authenticated client:', error);
        throw error;
    }
}

async function listEvents(user, { timeMin, timeMax }) {
    // Check if Google Calendar OAuth is configured
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.log(`📅 Google Calendar OAuth not configured. Skipping Google Calendar events.`);
        return [];
    }

    // Only fetch Google Calendar events if user has connected their calendar
    if (!user.calendarAccessToken && !user.calendarRefreshToken) {
        console.log(`📅 Google Calendar not connected for user ${user.email}`);
        return [];
    }

    try {
        const auth = await getAuthenticatedClient(user);
        const calendar = google.calendar({ version: 'v3', auth });
        console.log(`📅 Fetching Google Calendar events for user: ${user.email}`);

        // Ensure dates are in RFC3339 format with timezone (required by Google Calendar API)
        // If dates don't have timezone, assume Philippines timezone (GMT+8)
        let timeMinFormatted = timeMin;
        let timeMaxFormatted = timeMax;

        // Check if dates already have timezone info (ends with +HH:MM, -HH:MM, or Z)
        const hasTimezone = (dateStr) => {
            if (!dateStr) return false;
            return /[+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z');
        };

        if (timeMin && !hasTimezone(timeMin)) {
            // Date doesn't have timezone - add Philippines timezone
            timeMinFormatted = timeMin.includes('T') ? `${timeMin}+08:00` : `${timeMin}T00:00:00+08:00`;
        }
        if (timeMax && !hasTimezone(timeMax)) {
            // Date doesn't have timezone - add Philippines timezone
            timeMaxFormatted = timeMax.includes('T') ? `${timeMax}+08:00` : `${timeMax}T00:00:00+08:00`;
        }

        console.log(`📅 Google Calendar API request - timeMin: ${timeMinFormatted}, timeMax: ${timeMaxFormatted}`);

        const resp = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMinFormatted,
            timeMax: timeMaxFormatted,
            singleEvents: true,
            orderBy: 'startTime'
        });
        const events = resp.data.items || [];
        console.log(`📅 Found ${events.length} Google Calendar events for user ${user.email}`);
        return events;
    } catch (error) {
        console.error(`❌ Error fetching Google Calendar events for user ${user.email}:`, error.message);
        console.error(`Error details:`, error);
        // Log the actual error response if available
        if (error.response && error.response.data) {
            console.error('Google Calendar API error response:', JSON.stringify(error.response.data, null, 2));
        }
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


