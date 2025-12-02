const mongoose = require('mongoose');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const Memo = require('../models/Memo');

/**
 * Parse date string with timezone, ensuring the date is preserved correctly
 * When user enters "2025-11-07T12:00:00+08:00", we want to store it so it displays as Nov 7
 * @param {string} isoString - ISO date string with timezone (e.g., "2025-11-07T12:00:00+08:00")
 * @returns {Date} - Date object that represents the correct date/time in Asia/Manila timezone
 */
function parseDateTimePreservingDate(isoString) {
    // Parse dates - JavaScript Date constructor handles ISO strings with timezone correctly
    // "2025-11-07T12:00:00+08:00" will be parsed as Nov 7 12:00 PM UTC+8 = Nov 7 04:00 AM UTC
    let date = new Date(isoString);

    // Extract date components from the original string to verify and ensure correct date
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}):(\d{2})$/);

    if (match) {
        const [, year, month, day, hours, minutes, seconds, tzSign, tzHours, tzMinutes] = match;
        const expectedDate = `${year}-${month}-${day}`;

        // Check what date this represents in Asia/Manila timezone
        const dateInManila = date.toLocaleDateString('en-US', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const actualDateParts = dateInManila.split('/');
        const actualDate = `${actualDateParts[2]}-${actualDateParts[0].padStart(2, '0')}-${actualDateParts[1].padStart(2, '0')}`;

        // If dates don't match, recalculate to ensure correct date
        if (actualDate !== expectedDate) {
            console.warn(`⚠️ Date mismatch! Expected ${expectedDate}, but got ${actualDate}. Correcting...`);
            // For UTC+8, Nov 7 12:00 PM = Nov 7 04:00 AM UTC
            const tzOffsetHours = parseInt(tzSign + tzHours);
            const tzOffsetMins = parseInt(tzSign + tzMinutes);
            date = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours) - tzOffsetHours,
                parseInt(minutes) - tzOffsetMins,
                parseInt(seconds)
            ));
            console.log(`📅 Corrected date - UTC: ${date.toISOString()}, Manila: ${date.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
        }
    }

    return date;
}

exports.list = async (req, res, next) => {
    try {
        // Validate user is authenticated
        if (!req.user || !req.user._id) {
            console.error('❌ CRITICAL: req.user is missing or invalid!', {
                hasUser: !!req.user,
                hasId: req.user?._id
            });
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        const { start, end, category, onlyCreatedByMe } = req.query;
        if (!start || !end) {
            return res.status(400).json({ message: 'start and end are required ISO dates' });
        }
        const rangeStart = new Date(start);
        const rangeEnd = new Date(end);

        // Filter events to show only:
        // 1. Events created by the current user, OR
        // 2. Events where the user is a participant (by department or email)
        const userId = req.user._id;
        const userEmail = (req.user.email || '').toLowerCase().trim();
        const userDepartment = req.user.department || '';

        console.log('\n🔍 ===== CALENDAR EVENT FILTERING =====');
        console.log(`👤 User: ${req.user.email}`);
        console.log(`📋 User ID: ${userId} (type: ${typeof userId})`);
        console.log(`🏢 User Department: ${userDepartment}`);
        console.log(`📅 Date Range: ${start} to ${end}`);

        // Build query filters - query at database level for better performance
        // Exclude archived events from calendar view (they should only appear in Archive section)
        const filters = { category: { $ne: 'archived' } };
        if (category && category !== 'archived') {
            filters.category = category;
        }

        // Use MongoDB query to filter by creator OR participants at database level
        // This is more efficient than fetching all and filtering in memory
        const allEvents = await CalendarEvent.findInRange(rangeStart, rangeEnd, filters).lean();
        console.log(`📊 Total events in DB for range: ${allEvents.length}`);

        if (allEvents.length > 0) {
            console.log('📅 Events in DB:');
            allEvents.forEach((e, idx) => {
                console.log(`  ${idx + 1}. "${e.title}" - CreatedBy: ${e.createdBy} (type: ${typeof e.createdBy}), Participants:`, JSON.stringify(e.participants));
            });
        }

        console.log(`📋 Total events before filtering: ${allEvents.length}`);

        const filteredEvents = allEvents.filter(event => {
            // Convert createdBy to string reliably - handle all cases
            let eventCreatorId = null;

            if (event.createdBy) {
                // Handle different formats of createdBy
                if (event.createdBy instanceof mongoose.Types.ObjectId) {
                    eventCreatorId = event.createdBy.toString();
                } else if (typeof event.createdBy === 'object' && event.createdBy.toString) {
                    eventCreatorId = event.createdBy.toString();
                } else if (typeof event.createdBy === 'string') {
                    eventCreatorId = event.createdBy;
                } else {
                    eventCreatorId = String(event.createdBy);
                }
            }

            // Convert both IDs to strings for comparison
            const creatorIdStr = eventCreatorId || null;
            const userIdStr = userId ? String(userId) : null;

            // Use both ObjectId.equals() and string comparison for reliability
            let isCreator = false;

            if (creatorIdStr && userIdStr) {
                try {
                    // Try ObjectId comparison first (most reliable)
                    if (creatorIdStr.length === 24 && userIdStr.length === 24) {
                        // Both look like ObjectId strings
                        const creatorObjId = new mongoose.Types.ObjectId(creatorIdStr);
                        const userObjId = new mongoose.Types.ObjectId(userIdStr);
                        isCreator = creatorObjId.equals(userObjId);

                        if (!isCreator) {
                            // Also try direct string comparison as fallback
                            isCreator = creatorIdStr === userIdStr;
                        }
                    } else {
                        // Use string comparison if not ObjectId format
                        isCreator = creatorIdStr === userIdStr;
                    }
                } catch (e) {
                    // Fallback to string comparison if ObjectId conversion fails
                    isCreator = creatorIdStr === userIdStr;
                    console.log(`⚠️ Error in ObjectId comparison, using string: ${e.message}`);
                }
            }

            console.log(`🔍 Event "${event.title}":`);
            console.log(`   CreatedBy (raw): ${JSON.stringify(event.createdBy)}`);
            console.log(`   CreatedBy (str): ${creatorIdStr}`);
            console.log(`   Current User ID: ${userIdStr}`);
            console.log(`   Match: ${isCreator}`);

            // If onlyCreatedByMe flag is set, ONLY show events created by the user
            if (onlyCreatedByMe === '1' || onlyCreatedByMe === 'true') {
                if (isCreator) {
                    console.log(`   ✅ SHOWN - User is creator (onlyCreatedByMe mode)`);
                    return true;
                } else {
                    console.log('   ❌ FILTERED OUT - onlyCreatedByMe flag set, user is not the creator');
                    return false;
                }
            }

            // If onlyCreatedByMe is NOT set, show events where user is creator OR participant
            if (isCreator) {
                console.log(`   ✅ SHOWN - User is creator`);
                return true;
            }

            // Check if user is a participant
            // IMPORTANT: If user is NOT the creator, they must be explicitly added as a participant
            const participants = event.participants || {};

            console.log(`   📋 Checking participants for event "${event.title}":`, JSON.stringify(participants));

            // Handle new format {departments: [], emails: []}
            if (participants && typeof participants === 'object' && !Array.isArray(participants)) {
                const departments = Array.isArray(participants.departments) ? participants.departments : [];
                const emails = Array.isArray(participants.emails) ? participants.emails.map(e => e.toLowerCase().trim()) : [];

                console.log(`   📋 Participant departments: ${JSON.stringify(departments)}, emails: ${JSON.stringify(emails)}`);
                console.log(`   👤 User department: "${userDepartment}", email: "${userEmail}"`);

                // If event has NO participants at all, ONLY creator can see it - filter out immediately
                if (departments.length === 0 && emails.length === 0) {
                    console.log(`   ❌ FILTERED OUT - Event has no participants, only creator can see it`);
                    return false;
                }

                // Check if user's department matches
                if (userDepartment && departments.length > 0 && departments.some(dept => dept === userDepartment)) {
                    console.log(`   ✅ SHOWN - User's department "${userDepartment}" matches participant departments`);
                    return true;
                }

                // Check if user's email matches (case-insensitive comparison)
                if (userEmail && emails.length > 0) {
                    const emailMatches = emails.some(email => {
                        const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : email;
                        return normalizedEmail === userEmail;
                    });
                    if (emailMatches) {
                        console.log(`   ✅ SHOWN - User's email "${userEmail}" matches participant emails`);
                        return true;
                    }
                }

                console.log(`   ❌ FILTERED OUT - User is not creator and not in participants`);
                return false;
            }
            // Handle legacy format (array of department strings)
            else if (Array.isArray(event.participants)) {
                const departments = event.participants.filter(d => typeof d === 'string');

                console.log(`   📋 Participant departments (legacy): ${JSON.stringify(departments)}`);

                // If event has NO participants, ONLY creator can see it - filter out immediately
                if (departments.length === 0) {
                    console.log(`   ❌ FILTERED OUT - Event has no participants (legacy format), only creator can see it`);
                    return false;
                }

                if (userDepartment && departments.includes(userDepartment)) {
                    console.log(`   ✅ SHOWN - User's department "${userDepartment}" matches participant departments (legacy)`);
                    return true;
                }

                console.log(`   ❌ FILTERED OUT - User is not creator and department "${userDepartment}" not in participant departments`);
                return false;
            } else {
                // Invalid or empty participants format - only creator can see it
                console.log(`   ❌ FILTERED OUT - Invalid participants format or no participants, only creator can see it`);
                return false;
            }
        });

        console.log(`✅ Filtered events count: ${filteredEvents.length} (after filtering for user ${req.user.email})`);
        console.log(`📋 Events shown:`, filteredEvents.map(e => `"${e.title}"`).join(', ') || 'None');
        console.log(`🔍 ===== END FILTERING =====\n`);

        // Add createdBy info and check if current user is creator for each event
        const userIdStr = userId.toString();
        const eventsWithCreator = filteredEvents.map(event => {
            const eventObj = { ...event };
            const creatorId = event.createdBy ?
                (event.createdBy._id ? event.createdBy._id.toString() : event.createdBy.toString()) :
                null;
            eventObj.isCreator = creatorId === userIdStr;
            return eventObj;
        });

        res.json(eventsWithCreator);
    } catch (err) {
        console.error('❌ Error in calendarController.list:', err);
        console.error('Error stack:', err.stack);
        console.error('Error details:', {
            message: err.message,
            name: err.name,
            code: err.code
        });
        // Return proper error response instead of just passing to error handler
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch calendar events',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

exports.getOne = async (req, res, next) => {
    try {
        const event = await CalendarEvent.findById(req.params.id).populate('createdBy', 'email firstName lastName');
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Check if current user is the creator - use reliable ObjectId comparison
        const userId = req.user._id.toString();
        let creatorId = null;

        // Get the raw document to check unpopulated createdBy field
        const eventDoc = event.toObject();
        
        // First, try to get creatorId from populated createdBy
        if (event.createdBy) {
            if (event.createdBy._id) {
                // Populated user object
                creatorId = event.createdBy._id.toString();
            } else if (typeof event.createdBy === 'object' && event.createdBy.toString) {
                creatorId = event.createdBy.toString();
            } else {
                creatorId = String(event.createdBy);
            }
        }
        
        // Fallback: if creatorId is still null, check the raw createdBy field from the document
        if (!creatorId && eventDoc.createdBy) {
            if (eventDoc.createdBy._id) {
                creatorId = eventDoc.createdBy._id.toString();
            } else {
                creatorId = String(eventDoc.createdBy);
            }
        }

        // Compare using ObjectId for reliability
        let isCreator = false;
        if (creatorId && userId) {
            try {
                // Try ObjectId comparison first (most reliable)
                if (creatorId.length === 24 && userId.length === 24) {
                    const creatorObjId = new mongoose.Types.ObjectId(creatorId);
                    const userObjId = new mongoose.Types.ObjectId(userId);
                    isCreator = creatorObjId.equals(userObjId);
                }
                // Fallback to string comparison
                if (!isCreator) {
                    isCreator = creatorId === userId;
                }
            } catch (e) {
                // Final fallback to string comparison
                isCreator = creatorId === userId;
            }
        }

        console.log('🔍 getOne - Creator check:', {
            eventId: req.params.id,
            creatorId,
            userId,
            isCreator,
            createdByType: typeof event.createdBy,
            createdByHasId: !!event.createdBy?._id
        });

        // Return event with creator info and permission flag
        eventDoc.isCreator = isCreator;

        // Also include createdBy._id as a string for easy frontend comparison
        if (creatorId) {
            eventDoc.createdById = creatorId;
        } else if (event.createdBy?._id) {
            eventDoc.createdById = event.createdBy._id.toString();
        } else {
            eventDoc.createdById = null;
        }

        res.json(eventDoc);
    } catch (err) {
        next(err);
    }
};

exports.create = async (req, res, next) => {
    try {
        const { title, start, end, allDay, category, participants, description, memoId } = req.body;
        console.log('Creating calendar event:', { title, start, end, category, participants, description, userId: req.user?._id });

        if (!title || !start || !end) {
            console.error('Validation failed: missing required fields', { title: !!title, start: !!start, end: !!end });
            return res.status(400).json({ message: 'Title, start and end are required' });
        }

        if (!req.user || !req.user._id) {
            console.error('No user found in request');
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        // Parse dates - preserve exact date/time as entered by user
        // When user enters "2025-11-07T12:00:00+08:00", we want to store it so it displays as Nov 7
        console.log('📅 Raw date strings received:', { start, end });

        // Use helper function to parse dates while preserving the correct date
        const startDate = parseDateTimePreservingDate(start);
        const endDate = parseDateTimePreservingDate(end);

        console.log('📅 Final parsed dates:', {
            startISO: startDate.toISOString(),
            endISO: endDate.toISOString(),
            startInManila: startDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' }),
            endInManila: endDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' })
        });

        // Validate dates
        if (isNaN(startDate.getTime())) {
            console.error('Invalid start date:', start);
            return res.status(400).json({ message: 'Invalid start date format' });
        }
        if (isNaN(endDate.getTime())) {
            console.error('Invalid end date:', end);
            return res.status(400).json({ message: 'Invalid end date format' });
        }

        // Normalize participants data - ensure emails are lowercase and trimmed
        let normalizedParticipants = participants || {};
        if (normalizedParticipants && typeof normalizedParticipants === 'object' && !Array.isArray(normalizedParticipants)) {
            // Normalize emails array
            if (Array.isArray(normalizedParticipants.emails)) {
                normalizedParticipants.emails = normalizedParticipants.emails.map(e => {
                    if (typeof e === 'string') {
                        return e.toLowerCase().trim();
                    }
                    return e;
                });
            }
            // Ensure departments array exists
            if (!Array.isArray(normalizedParticipants.departments)) {
                normalizedParticipants.departments = [];
            }
        } else if (Array.isArray(normalizedParticipants)) {
            // Legacy format - convert to new format
            normalizedParticipants = {
                departments: normalizedParticipants.filter(d => typeof d === 'string'),
                emails: []
            };
        } else {
            normalizedParticipants = { departments: [], emails: [] };
        }

        const eventData = {
            title,
            start: startDate,
            end: endDate,
            allDay: !!allDay,
            category: category || 'standard',
            participants: normalizedParticipants,
            description: description || '',
            memoId: memoId || undefined,
            createdBy: req.user._id
        };

        console.log('Event data to save:', eventData);
        console.log('Parsed dates - start:', startDate.toISOString(), 'end:', endDate.toISOString());

        const event = await CalendarEvent.create(eventData);
        console.log('Event created successfully:', event._id, 'Title:', event.title);

        // Send notifications to participants
        try {
            await notifyEventParticipants(event, req.user);
        } catch (notifyError) {
            console.error('Error sending event notifications:', notifyError);
            // Don't fail the request if notifications fail
        }

        // Sync event to participants' Google Calendars (async, don't wait)
        try {
            const { syncEventToParticipantsGoogleCalendars } = require('../services/calendarService');
            syncEventToParticipantsGoogleCalendars(event, { isUpdate: false })
                .catch(err => console.error('Error syncing to Google Calendars:', err));
        } catch (syncError) {
            console.error('Error initiating Google Calendar sync:', syncError);
            // Don't fail the request if sync fails
        }

        // Populate the createdBy field for response
        const populatedEvent = await CalendarEvent.findById(event._id).populate('createdBy', 'firstName lastName email');
        res.status(201).json(populatedEvent);
    } catch (err) {
        console.error('Error creating calendar event:', err);
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        // Get the original event first to check permissions
        const originalEvent = await CalendarEvent.findById(req.params.id);
        if (!originalEvent) {return res.status(404).json({ message: 'Event not found' });}

        // Check if user is the creator - use reliable ObjectId comparison
        const userId = req.user._id.toString();
        let creatorId = null;

        if (originalEvent.createdBy) {
            if (originalEvent.createdBy._id) {
                creatorId = originalEvent.createdBy._id.toString();
            } else if (typeof originalEvent.createdBy === 'object' && originalEvent.createdBy.toString) {
                creatorId = originalEvent.createdBy.toString();
            } else {
                creatorId = String(originalEvent.createdBy);
            }
        }

        // Compare using ObjectId for reliability
        let isCreator = false;
        if (creatorId && userId) {
            try {
                // Try ObjectId comparison first (most reliable)
                if (creatorId.length === 24 && userId.length === 24) {
                    const creatorObjId = new mongoose.Types.ObjectId(creatorId);
                    const userObjId = new mongoose.Types.ObjectId(userId);
                    isCreator = creatorObjId.equals(userObjId);
                }
                // Fallback to string comparison
                if (!isCreator) {
                    isCreator = creatorId === userId;
                }
            } catch (e) {
                // Final fallback to string comparison
                isCreator = creatorId === userId;
            }
        }

        if (!isCreator) {
            return res.status(403).json({ message: 'Only the event creator can edit this event' });
        }

        const updates = { ...req.body };
        // Use the same date parsing function to preserve dates correctly
        if (updates.start) {updates.start = parseDateTimePreservingDate(updates.start);}
        if (updates.end) {updates.end = parseDateTimePreservingDate(updates.end);}

        // Normalize participants data if provided
        if (updates.participants) {
            const normalizedParticipants = updates.participants;
            if (normalizedParticipants && typeof normalizedParticipants === 'object' && !Array.isArray(normalizedParticipants)) {
                // Normalize emails array
                if (Array.isArray(normalizedParticipants.emails)) {
                    normalizedParticipants.emails = normalizedParticipants.emails.map(e => {
                        if (typeof e === 'string') {
                            return e.toLowerCase().trim();
                        }
                        return e;
                    });
                }
                // Ensure departments array exists
                if (!Array.isArray(normalizedParticipants.departments)) {
                    normalizedParticipants.departments = [];
                }
                updates.participants = normalizedParticipants;
            } else if (Array.isArray(normalizedParticipants)) {
                // Legacy format - convert to new format
                updates.participants = {
                    departments: normalizedParticipants.filter(d => typeof d === 'string'),
                    emails: []
                };
            } else {
                updates.participants = { departments: [], emails: [] };
            }
        }

        // Store old participants for Google Calendar sync
        const oldParticipants = originalEvent.participants ? JSON.parse(JSON.stringify(originalEvent.participants)) : null;

        const event = await CalendarEvent.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!event) {return res.status(404).json({ message: 'Event not found' });}

        // Update participant notifications if event details changed
        const shouldUpdateNotifications =
            originalEvent.category !== event.category ||
            originalEvent.title !== event.title ||
            originalEvent.start.getTime() !== event.start.getTime() ||
            originalEvent.end.getTime() !== event.end.getTime() ||
            originalEvent.description !== event.description;

        if (shouldUpdateNotifications) {
            try {
                await updateEventNotifications(event, req.user);
            } catch (notifyError) {
                console.error('Error updating event notifications:', notifyError);
                // Don't fail the request if notifications fail
            }
        }

        // Sync event updates to participants' Google Calendars (async, don't wait)
        try {
            const { syncEventToParticipantsGoogleCalendars } = require('../services/calendarService');
            syncEventToParticipantsGoogleCalendars(event, { isUpdate: true, oldParticipants })
                .catch(err => console.error('Error syncing to Google Calendars:', err));
        } catch (syncError) {
            console.error('Error initiating Google Calendar sync:', syncError);
            // Don't fail the request if sync fails
        }

        res.json(event);
    } catch (err) {
        next(err);
    }
};

exports.updateTime = async (req, res, next) => {
    try {
        const { start, end } = req.body;
        if (!start || !end) {return res.status(400).json({ message: 'start and end are required' });}

        // Check if user is the creator
        const event = await CalendarEvent.findById(req.params.id);
        if (!event) {return res.status(404).json({ message: 'Event not found' });}

        const userId = req.user._id.toString();
        const creatorId = event.createdBy ?
            (event.createdBy._id ? event.createdBy._id.toString() : event.createdBy.toString()) :
            event.createdBy.toString();

        if (creatorId !== userId) {
            return res.status(403).json({ message: 'Only the event creator can modify this event' });
        }

        // Use the same date parsing function to preserve dates correctly
        const updatedEvent = await CalendarEvent.findByIdAndUpdate(
            req.params.id,
            { start: parseDateTimePreservingDate(start), end: parseDateTimePreservingDate(end) },
            { new: true }
        );
        res.json(updatedEvent);
    } catch (err) {
        next(err);
    }
};

exports.remove = async (req, res, next) => {
    try {
        const event = await CalendarEvent.findById(req.params.id);
        if (!event) {return res.status(404).json({ message: 'Event not found' });}

        // Check if user is the creator
        const userId = req.user._id.toString();
        const creatorId = event.createdBy ?
            (event.createdBy._id ? event.createdBy._id.toString() : event.createdBy.toString()) :
            event.createdBy.toString();

        if (creatorId !== userId) {
            return res.status(403).json({ message: 'Only the event creator can delete this event' });
        }

        // Delete event from participants' Google Calendars (async, don't wait)
        try {
            const { deleteEvent } = require('../services/calendarService');
            const User = require('../models/User');

            if (event.googleCalendarEventIds && typeof event.googleCalendarEventIds === 'object') {
                const googleEventIds = event.googleCalendarEventIds;
                const participantEmails = Object.keys(googleEventIds);

                for (const email of participantEmails) {
                    const googleEventId = googleEventIds[email];
                    if (googleEventId) {
                        try {
                            const participantUser = await User.findOne({ email: email.toLowerCase().trim() }).lean();
                            if (participantUser && (participantUser.calendarAccessToken || participantUser.calendarRefreshToken)) {
                                console.log(`📅 Deleting event from Google Calendar for ${email}`);
                                await deleteEvent(participantUser, googleEventId);
                                console.log(`✅ Deleted event from Google Calendar for ${email}`);
                            }
                        } catch (error) {
                            console.error(`❌ Error deleting event from ${email}'s Google Calendar:`, error.message);
                        }
                    }
                }
            }
        } catch (syncError) {
            console.error('Error deleting from Google Calendars:', syncError);
            // Don't fail the request if sync fails
        }

        await CalendarEvent.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        next(err);
    }
};

exports.archive = async (req, res, next) => {
    try {
        const event = await CalendarEvent.findById(req.params.id);
        if (!event) {return res.status(404).json({ message: 'Event not found' });}

        // Check if user is the creator
        const userId = req.user._id.toString();
        const creatorId = event.createdBy ?
            (event.createdBy._id ? event.createdBy._id.toString() : event.createdBy.toString()) :
            event.createdBy.toString();

        if (creatorId !== userId) {
            return res.status(403).json({ message: 'Only the event creator can archive this event' });
        }

        // Set category to 'archived' to mark the event as archived
        event.category = 'archived';
        const archivedEvent = await event.save();

        console.log(`✅ Event "${archivedEvent.title}" (ID: ${archivedEvent._id}) has been archived`);

        res.json(archivedEvent);
    } catch (err) {
        console.error('Error archiving event:', err);
        next(err);
    }
};

// Get memo notification for an event (for non-creators)
exports.getEventMemo = async (req, res, next) => {
    try {
        const eventId = req.params.id;
        const userId = req.user._id;

        console.log(`🔍 Looking for memo notification for event ${eventId} and user ${req.user.email}`);

        // Find memo notification for this event and current user
        const memo = await Memo.findOne({
            'metadata.eventId': eventId,
            'metadata.eventType': 'calendar_event',
            recipient: userId,
            status: { $ne: 'deleted' }
        }).populate('sender', 'firstName lastName email')
          .populate('recipient', 'firstName lastName email');

        if (!memo) {
            console.log(`❌ No memo found for event ${eventId} and user ${req.user.email}`);
            // Try to find all memos for this event to debug
            const allEventMemos = await Memo.find({
                'metadata.eventId': eventId,
                'metadata.eventType': 'calendar_event'
            }).select('recipient metadata');
            console.log(`📋 All memos for event ${eventId}:`, allEventMemos.map(m => ({
                recipient: m.recipient,
                metadata: m.metadata
            })));

            return res.status(404).json({ message: 'Memo notification not found for this event' });
        }

        console.log(`✅ Found memo ${memo._id} for event ${eventId}`);
        res.json(memo);
    } catch (err) {
        console.error('❌ Error in getEventMemo:', err);
        next(err);
    }
};

// Helper function to update existing event notifications
async function updateEventNotifications(event, updater) {
    try {
        // Find all notification memos for this event
        const existingMemos = await Memo.find({
            'metadata.eventId': event._id.toString(),
            'metadata.eventType': 'calendar_event',
            status: { $ne: 'deleted' }
        }).populate('recipient', 'email');

        if (existingMemos.length === 0) {
            console.log('No existing notifications found to update for event:', event._id);
            return;
        }

        // Get event creator for sender field
        const creator = await User.findById(event.createdBy).select('email firstName lastName');
        if (!creator) {
            console.log('Event creator not found:', event.createdBy);
            return;
        }

        // Format event date/time
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const startTimeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const endTimeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        const categoryLabels = {
            urgent: '🔴 Urgent',
            high: '🟠 High Priority',
            standard: '🟢 Standard',
            meeting: '🟣 Meeting',
            deadline: '⏰ Deadline',
            reminder: '🔔 Reminder',
            low: '🔵 Low Priority'
        };
        const categoryLabel = categoryLabels[event.category] || event.category;

        // Map calendar event category to memo priority
        const categoryToPriority = {
            urgent: 'urgent',
            high: 'high',
            meeting: 'high',
            deadline: 'urgent',
            reminder: 'medium',
            standard: 'medium',
            low: 'low'
        };
        const memoPriority = categoryToPriority[event.category] || 'medium';

        // Update all notification memos
        const updatePromises = existingMemos.map(async (memo) => {
            // Format content for calendar event update notification (simple format)
            let updateContent = `${event.title}\n\n`;
            updateContent += `Date: ${dateStr}\n`;
            updateContent += `Time: ${startTimeStr} - ${endTimeStr}\n`;
            updateContent += `Category: ${categoryLabel}\n`;
            if (event.description) {
                updateContent += `Description: ${event.description}\n`;
            }

            memo.subject = `📅 Calendar Event Updated: ${event.title}`;
            memo.content = updateContent;
            memo.priority = memoPriority;
            memo.isRead = false; // Mark as unread so recipient sees the update
            memo.metadata.category = event.category;
            memo.updatedAt = new Date();
            return await memo.save();
        });

        const updatedMemos = await Promise.all(updatePromises);
        console.log(`✅ Updated ${updatedMemos.length} notifications for event "${event.title}" (ID: ${event._id})`);

    } catch (error) {
        console.error('❌ Error in updateEventNotifications:', error);
        throw error;
    }
}

// Helper function to send notifications to event participants
async function notifyEventParticipants(event, creator) {
    try {
        const participants = event.participants || {};

        // Handle both new format {departments: [], emails: []} and legacy array format
        let departments = [];
        let emails = [];

        if (participants && typeof participants === 'object' && !Array.isArray(participants)) {
            departments = Array.isArray(participants.departments) ? participants.departments : [];
            emails = Array.isArray(participants.emails) ? participants.emails : [];
        } else if (Array.isArray(event.participants)) {
            // Legacy format: array of department strings
            departments = event.participants.filter(d => typeof d === 'string');
        }

        // Get all users who should be notified
        const recipientIds = new Set();

        // Find users by departments
        if (departments.length > 0) {
            const departmentUsers = await User.find({
                department: { $in: departments },
                isActive: true
            }).select('_id email');

            departmentUsers.forEach(user => {
                recipientIds.add(user._id.toString());
            });
            console.log(`Found ${departmentUsers.length} users from departments:`, departments);
        }

        // Find users by emails
        if (emails.length > 0) {
            const emailUsers = await User.find({
                email: { $in: emails.map(e => e.toLowerCase().trim()) },
                isActive: true
            }).select('_id email');

            emailUsers.forEach(user => {
                recipientIds.add(user._id.toString());
            });
            console.log(`Found ${emailUsers.length} users from emails:`, emails);
        }

        // Remove creator from recipients (they don't need to notify themselves)
        // Also check by email to be extra sure
        const creatorId = creator._id.toString();
        const creatorEmail = (creator.email || '').toLowerCase().trim();
        recipientIds.delete(creatorId);

        // Also remove if creator's email was in the participants list
        const finalRecipientIds = Array.from(recipientIds).filter(id => {
            // We'll filter out creator email matches when creating memos
            return id !== creatorId;
        });

        if (finalRecipientIds.length === 0) {
            console.log('No recipients to notify for event (creator excluded):', event._id);
            return;
        }

        console.log(`Preparing to notify ${finalRecipientIds.length} recipients (excluding creator: ${creator.email})`);

        // Format event date/time
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const startTimeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const endTimeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        const categoryLabels = {
            urgent: '🔴 Urgent',
            high: '🟠 High Priority',
            standard: '🟢 Standard',
            meeting: '🟣 Meeting',
            deadline: '⏰ Deadline',
            reminder: '🔔 Reminder',
            low: '🔵 Low Priority'
        };
        const categoryLabel = categoryLabels[event.category] || event.category;

        // Map calendar event category to memo priority
        const categoryToPriority = {
            urgent: 'urgent',
            high: 'high',
            meeting: 'high',
            deadline: 'urgent',
            reminder: 'medium',
            standard: 'medium',
            low: 'low'
        };
        const memoPriority = categoryToPriority[event.category] || 'medium';

        // Create notification memos for each recipient
        const memoPromises = finalRecipientIds.map(async (recipientId) => {
            // Double-check this isn't the creator
            if (recipientId === creatorId) {
                console.log('Skipping creator as recipient:', creator.email);
                return null;
            }

            const recipientUser = await User.findById(recipientId).select('email');
            if (!recipientUser) {
                console.log('Recipient user not found:', recipientId);
                return null;
            }

            // Final check: ensure recipient email doesn't match creator
            if (recipientUser.email && recipientUser.email.toLowerCase().trim() === creatorEmail) {
                console.log('Skipping creator email match:', recipientUser.email);
                return null;
            }
            // Format content for calendar event notification (simple format)
            let content = `${event.title}\n\n`;
            content += `Date: ${dateStr}\n`;
            content += `Time: ${startTimeStr} - ${endTimeStr}\n`;
            content += `Category: ${categoryLabel}\n`;
            if (event.description) {
                content += `Description: ${event.description}\n`;
            }

            const memo = new Memo({
                sender: creator._id,
                recipient: recipientId,
                subject: `📅 Calendar Event: ${event.title}`,
                content: content,
                activityType: 'system_notification',
                status: 'sent',
                priority: memoPriority, // Map category to priority
                isRead: false,
                metadata: {
                    eventId: event._id.toString(),
                    eventType: 'calendar_event',
                    category: event.category
                }
            });
            return await memo.save();
        });

        const createdMemos = (await Promise.all(memoPromises)).filter(m => m !== null);
        console.log(`✅ Sent ${createdMemos.length} notifications for event "${event.title}" (ID: ${event._id})`);
        if (createdMemos.length === 0) {
            console.log('⚠️  No notifications were sent - all recipients were filtered out (likely all were the creator)');
        }

    } catch (error) {
        console.error('❌ Error in notifyEventParticipants:', error);
        throw error;
    }
}


