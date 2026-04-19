const mongoose = require('mongoose');

// Schema for tracking individual stops in a trip's timeline
const tripStopSchema = new mongoose.Schema({
    stopId: {
        type: mongoose.Schema.Types.Mixed, // Could be ObjectId ref to Location, or just a string if derived from Route directly
        required: true
    },
    name: {
        type: String,
        required: true
    },
    coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true }
    },
    geofenceRadius: {
        type: Number,
        default: 200 // meters
    },
    order: {
        type: Number,
        required: true
    },
    scheduledArrival: Date, // Expected arrival time based on schedule
    actualArrival: Date, // Real arrival time logged via GPS or manual override
    status: {
        type: String,
        enum: ['pending', 'arrived', 'departed', 'skipped'],
        default: 'pending'
    },
    delayMinutes: {
        type: Number,
        default: 0
    }
}, { _id: false });

// External events log
const eventLogSchema = new mongoose.Schema({
    eventType: {
        type: String,
        enum: [
            'trip_started',
            'arrived_at_stop',
            'departed_from_stop',
            'stop_skipped',
            'delay_updated',
            'trip_paused',
            'trip_restarted',
            'trip_completed',
            'trip_cancelled',
            'gps_loss',
            'gps_restored',
            'manual_override'
        ],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    details: String, // E.g., "Arrived at Stop 3 manually"
    byUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Staff/Driver who triggered a manual override
    },
    location: {
        latitude: Number,
        longitude: Number
    }
}, { _id: false });

// Main TripTimeline Schema
const tripTimelineSchema = new mongoose.Schema({
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true,
        index: true
    },
    busId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bus',
        required: true,
        index: true
    },
    tripNumber: {
        type: String, // Useful for multi-trip per day (e.g., "Morning-Run", "Trip-1")
        index: true
    },
    serviceDate: {
        type: Date,
        required: true,
        index: true
    },
    // Personnel and Vehicle
    driverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    conductorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Trip Lifecycle
    status: {
        type: String,
        enum: ['scheduled', 'boarding', 'running', 'paused', 'completed', 'cancelled'],
        default: 'scheduled',
        index: true
    },

    // Configuration
    bookingCutoffMinutes: {
        type: Number,
        default: 30 // Booking closes X mins before departure
    },

    // Timeline array
    stops: [tripStopSchema],

    // Activity Ledger
    eventLogs: [eventLogSchema]

}, {
    timestamps: true
});

// Compound indexes
tripTimelineSchema.index({ busId: 1, serviceDate: 1, status: 1 });
tripTimelineSchema.index({ routeId: 1, serviceDate: 1 });
tripTimelineSchema.index({ status: 1 });
tripTimelineSchema.index({ 'stops.coordinates.longitude': 1, 'stops.coordinates.latitude': 1 }); // Index for stop locations

// Instance Method: Log an event
tripTimelineSchema.methods.logEvent = async function (eventType, details, byUser = null, location = null) {
    this.eventLogs.push({
        eventType,
        timestamp: new Date(),
        details,
        byUser,
        location
    });
    return this.save();
};

// Instance Method: Record Arrival
tripTimelineSchema.methods.recordArrival = async function (stopIndex, isManual = false, userId = null, location = null) {
    if (stopIndex < 0 || stopIndex >= this.stops.length) throw new Error("Invalid stop index");

    const stop = this.stops[stopIndex];
    if (stop.status === 'arrived' || stop.status === 'departed') return this; // Already processed

    const actualArrival = new Date();
    let delayMinutes = 0;

    // Calculate delay if applicable
    if (stop.scheduledArrival) {
        const diffMs = actualArrival - stop.scheduledArrival;
        delayMinutes = Math.round(diffMs / 60000);
    }

    // Determine event details based on manual vs. automated GPS
    const method = isManual ? "Manually" : "via GPS";
    const details = `${method} arrived at ${stop.name}. Delay: ${delayMinutes} mins.`;

    const newEvent = {
        eventType: isManual ? 'manual_override' : 'arrived_at_stop',
        timestamp: new Date(),
        details,
        byUser: userId,
        location
    };

    // Atomic update to prevent race conditions during concurrent GPS pings
    const updatedTrip = await this.constructor.findOneAndUpdate(
        {
            _id: this._id,
            [`stops.${stopIndex}.status`]: 'pending' // Only update if still pending
        },
        {
            $set: {
                [`stops.${stopIndex}.status`]: 'arrived',
                [`stops.${stopIndex}.actualArrival`]: actualArrival,
                [`stops.${stopIndex}.delayMinutes`]: delayMinutes
            },
            $push: { eventLogs: newEvent }
        },
        { new: true } // Return updated document
    );

    if (!updatedTrip) {
        // The stop was already updated by another concurrent request
        return this;
    }

    // Keep the instance synchronized
    Object.assign(this, updatedTrip);

    return this;
};

// Add GPS Tracking Variables to support timeouts
tripTimelineSchema.add({
    lastGpsPing: Date,
    isGpsLost: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('TripTimeline', tripTimelineSchema);
