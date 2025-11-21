const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt before saving
systemSettingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Static method to get a setting
systemSettingSchema.statics.get = async function (key) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : null;
};

// Static method to set a setting
systemSettingSchema.statics.set = async function (key, value, updatedBy = null) {
    return await this.findOneAndUpdate(
        { key },
        {
            key,
            value,
            updatedBy,
            updatedAt: Date.now()
        },
        { upsert: true, new: true }
    );
};

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

module.exports = SystemSetting;

