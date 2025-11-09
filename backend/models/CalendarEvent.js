const mongoose = require('mongoose');

const CalendarEventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true, index: true },
    allDay: { type: Boolean, default: false },
    category: { type: String, enum: ['today', 'urgent', 'standard', 'archived'], default: 'standard', index: true },
    participants: { type: mongoose.Schema.Types.Mixed, default: [] }, // Can be array of strings (legacy) or {departments: [], emails: []}
    description: { type: String, default: '' },
    memoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memo', required: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['scheduled', 'sent', 'cancelled'], default: 'scheduled' }
}, {
    timestamps: true
});

// Overlap query helper
CalendarEventSchema.statics.findInRange = function(start, end, filters = {}) {
    return this.find({
        $and: [
            { start: { $lt: end } },
            { end: { $gt: start } },
            filters
        ]
    }).sort({ start: 1 });
};

CalendarEventSchema.index({ start: 1, end: 1 });

module.exports = mongoose.model('CalendarEvent', CalendarEventSchema);


