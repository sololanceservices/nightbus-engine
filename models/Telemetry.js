const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
    busId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bus',
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    speed: Number,
    heading: Number,
    fuelLevel: Number,
    batteryLevel: Number,
    occupancy: Number,
    ignitionStatus: Boolean,
    doorStatus: String, // 'open', 'closed'
    rawPayload: mongoose.Schema.Types.Mixed // Store full raw data for debugging
}, { timestamps: true });

telemetrySchema.index({ busId: 1, timestamp: -1 });

module.exports = mongoose.model('Telemetry', telemetrySchema);
