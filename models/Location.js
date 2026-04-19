const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    state: {
        type: String,
        index: true
    },
    district: String,
    type: {
        type: String,
        enum: ['city', 'town', 'village', 'stop', 'landmark', 'pickup', 'drop', 'temple', 'boarding_stop', 'drop_stop', 'viewpoint', 'fuel_stop', 'rest_stop'],
        default: 'city'
    },
    coordinates: {
        latitude: Number,
        longitude: Number
    },
    aliases: [String], // Alternative names, spellings
    popularity: {
        type: Number,
        default: 0,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isGlobal: {
        type: Boolean,
        default: false,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    }
}, {
    timestamps: true
});

// Text index for search
locationSchema.index({ name: 'text', aliases: 'text', state: 'text' });

module.exports = mongoose.model('Location', locationSchema);
