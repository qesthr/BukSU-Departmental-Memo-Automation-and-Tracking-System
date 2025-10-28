const CalendarEvent = require('../models/CalendarEvent');

exports.list = async (req, res, next) => {
    try {
        const { start, end, category } = req.query;
        if (!start || !end) {
            return res.status(400).json({ message: 'start and end are required ISO dates' });
        }
        const rangeStart = new Date(start);
        const rangeEnd = new Date(end);
        const filters = {};
        if (category) filters.category = category;
        const events = await CalendarEvent.findInRange(rangeStart, rangeEnd, filters).lean();
        res.json(events);
    } catch (err) {
        next(err);
    }
};

exports.create = async (req, res, next) => {
    try {
        const { title, start, end, allDay, category, participants, description, memoId } = req.body;
        if (!title || !start || !end) {
            return res.status(400).json({ message: 'Title, start and end are required' });
        }
        const event = await CalendarEvent.create({
            title,
            start: new Date(start),
            end: new Date(end),
            allDay: !!allDay,
            category: category || 'standard',
            participants: participants || [],
            description: description || '',
            memoId: memoId || undefined,
            createdBy: req.user._id
        });
        res.status(201).json(event);
    } catch (err) {
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        const updates = { ...req.body };
        if (updates.start) updates.start = new Date(updates.start);
        if (updates.end) updates.end = new Date(updates.end);
        const event = await CalendarEvent.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (err) {
        next(err);
    }
};

exports.updateTime = async (req, res, next) => {
    try {
        const { start, end } = req.body;
        if (!start || !end) return res.status(400).json({ message: 'start and end are required' });
        const event = await CalendarEvent.findByIdAndUpdate(
            req.params.id,
            { start: new Date(start), end: new Date(end) },
            { new: true }
        );
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json(event);
    } catch (err) {
        next(err);
    }
};

exports.remove = async (req, res, next) => {
    try {
        const event = await CalendarEvent.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        next(err);
    }
};


