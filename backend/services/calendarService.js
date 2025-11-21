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

/**
 * Fetch public holidays from Google Calendar's public holiday calendars
 * This doesn't require OAuth - uses API key only
 */
async function fetchPublicHolidays({ timeMin, timeMax }) {
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) {
        console.log('📅 Google Calendar API key not configured. Skipping public holidays.');
        return [];
    }

    try {
        // Convert date strings to proper RFC3339 format for Google Calendar API
        const formatForAPI = (dateStr) => {
            if (!dateStr) return null;

            let date;
            // If it's already a Date object, use it
            if (dateStr instanceof Date) {
                date = dateStr;
            } else {
                // Parse the date string
                date = new Date(dateStr);
            }

            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.warn(`⚠️ Invalid date format: ${dateStr}`);
                return null;
            }

            // Convert to RFC3339 format (YYYY-MM-DDTHH:mm:ss+HH:mm)
            // Use Asia/Manila timezone
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');

            // Return in RFC3339 format with +08:00 timezone (Philippines)
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
        };

        const timeMinFormatted = formatForAPI(timeMin);
        const timeMaxFormatted = formatForAPI(timeMax);

        if (!timeMinFormatted || !timeMaxFormatted) {
            console.warn('⚠️ Could not format dates for public holidays API request');
            console.warn(`   timeMin: ${timeMin}, timeMax: ${timeMax}`);
            return [];
        }

        console.log(`🎉 Fetching public holidays for date range: ${timeMinFormatted} to ${timeMaxFormatted}`);

        // Philippines public holiday calendar ID
        const philippinesHolidayCalendarId = 'en.philippines#holiday@group.v.calendar.google.com';

        // Build URL with proper encoding
        const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars';
        const calendarIdEncoded = encodeURIComponent(philippinesHolidayCalendarId);
        const url = `${baseUrl}/${calendarIdEncoded}/events`;

        // Use axios with query parameters instead of building URL manually
        const axios = require('axios');
        const response = await axios.get(url, {
            params: {
                key: apiKey,
                timeMin: timeMinFormatted,
                timeMax: timeMaxFormatted,
                singleEvents: true,
                orderBy: 'startTime'
            }
        });

        const events = response.data.items || [];

        console.log(`🎉 API returned ${events.length} raw events from Philippines holiday calendar`);
        if (events.length > 0) {
            console.log(`🎉 Sample holiday: "${events[0].summary}" on ${events[0].start.date || events[0].start.dateTime}`);
        }

        // Mark all as holidays
        const holidayEvents = events.map(ev => ({
            ...ev,
            calendarId: philippinesHolidayCalendarId,
            isHoliday: true,
            source: 'public_holiday'
        }));

        console.log(`🎉 Found ${holidayEvents.length} public holidays from Philippines calendar`);
        return holidayEvents;
    } catch (error) {
        console.warn(`⚠️ Error fetching public holidays:`, error.message);
        if (error.response) {
            console.warn(`⚠️ API Error Response:`, error.response.data);
        }
        // Don't throw - holidays are optional
        return [];
    }
}

async function listEvents(user, { timeMin, timeMax }) {
    let allEvents = [];

    // Always fetch public holidays first (doesn't require OAuth)
    const publicHolidays = await fetchPublicHolidays({ timeMin, timeMax });
    allEvents = [...allEvents, ...publicHolidays];

    // Check if Google Calendar OAuth is configured
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        console.log(`📅 Google Calendar OAuth not configured. Returning ${allEvents.length} public holidays only.`);
        return allEvents;
    }

    // Only fetch Google Calendar events if user has connected their calendar
    if (!user.calendarAccessToken && !user.calendarRefreshToken) {
        console.log(`📅 Google Calendar not connected for user ${user.email}. Returning ${allEvents.length} public holidays only.`);
        return allEvents;
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

        // Fetch events from primary calendar
        const primaryResp = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMinFormatted,
            timeMax: timeMaxFormatted,
            singleEvents: true,
            orderBy: 'startTime'
        });
        const primaryEvents = (primaryResp.data.items || []).map(ev => ({
            ...ev,
            calendarId: 'primary',
            isHoliday: false
        }));

        // Fetch events from all calendars (including holiday calendars)
        let allEvents = [...primaryEvents];
        try {
            const calendarsResp = await calendar.calendarList.list({
                minAccessRole: 'reader'
            });
            const calendars = calendarsResp.data.items || [];
            console.log(`📅 Found ${calendars.length} calendars for user ${user.email}`);

            // Identify holiday calendars (they typically contain "holiday" in the ID or summary)
            const holidayCalendarIds = calendars
                .filter(cal => {
                    const id = cal.id || '';
                    const summary = (cal.summary || '').toLowerCase();
                    return id.includes('#holiday@') ||
                           id.includes('holiday') ||
                           summary.includes('holiday') ||
                           summary.includes('holidays');
                })
                .map(cal => cal.id);

            console.log(`🎉 Found ${holidayCalendarIds.length} holiday calendars:`, holidayCalendarIds);

            // Fetch events from holiday calendars
            for (const holidayCalId of holidayCalendarIds) {
                try {
                    const holidayResp = await calendar.events.list({
                        calendarId: holidayCalId,
                        timeMin: timeMinFormatted,
                        timeMax: timeMaxFormatted,
                        singleEvents: true,
                        orderBy: 'startTime'
                    });
                    const holidayEvents = (holidayResp.data.items || []).map(ev => ({
                        ...ev,
                        calendarId: holidayCalId,
                        isHoliday: true
                    }));
                    allEvents = [...allEvents, ...holidayEvents];
                    console.log(`🎉 Found ${holidayEvents.length} holiday events from calendar ${holidayCalId}`);
                } catch (holidayError) {
                    console.warn(`⚠️ Error fetching events from holiday calendar ${holidayCalId}:`, holidayError.message);
                    // Continue with other calendars even if one fails
                }
            }
        } catch (calendarListError) {
            console.warn(`⚠️ Error fetching calendar list (will only use primary calendar):`, calendarListError.message);
            // If we can't list calendars, just use primary calendar events
        }

        console.log(`📅 Found ${allEvents.length} total Google Calendar events (${primaryEvents.length} primary, ${allEvents.length - primaryEvents.length} from user's holiday calendars)`);
        console.log(`📅 Total events including public holidays: ${allEvents.length}`);
        return allEvents;
    } catch (error) {
        console.error(`❌ Error fetching Google Calendar events for user ${user.email}:`, error.message);
        console.error(`Error details:`, error);
        // Log the actual error response if available
        if (error.response && error.response.data) {
            console.error('Google Calendar API error response:', JSON.stringify(error.response.data, null, 2));
        }
        // Return public holidays even if OAuth fails
        console.log(`📅 Returning ${allEvents.length} public holidays despite OAuth error`);
        return allEvents;
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


