const mongoose = require('mongoose');
const Bus = mongoose.model('Bus');

// Update bus location from GPS device
exports.updateLocation = async (req, res) => {
    try {
        const { deviceId, latitude, longitude, speed, timestamp, heading } = req.body;

        if (!deviceId || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: deviceId, latitude, longitude'
            });
        }

        // Find bus by GPS Device ID
        const bus = await Bus.findOne({ gpsDeviceId: deviceId });

        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'Bus not found with this Device ID'
            });
        }

        // Update location
        bus.currentLocation = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
        };

        bus.lastKnownLocation = {
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
            speed: parseFloat(speed) || 0,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            heading: parseInt(heading) || 0
        };

        await bus.save();

        // ---------------------------------------------------------
        // GEOFENCE VALIDATION LOGIC 
        // ---------------------------------------------------------
        // Find active TripTimeline(s) for this bus today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const TripTimeline = mongoose.model('TripTimeline');

        // Find a running trip for this bus today
        const activeTrip = await TripTimeline.findOne({
            busId: bus._id,
            status: 'running',
            serviceDate: { $gte: startOfDay, $lte: endOfDay }
        });

        if (activeTrip) {
            // Check if GPS was lost previously and restored
            if (activeTrip.isGpsLost) {
                activeTrip.isGpsLost = false;
                await activeTrip.logEvent('gps_restored', 'GPS signal restored', null, { latitude, longitude });
            }

            // Update last GPS ping heartbeat
            activeTrip.lastGpsPing = new Date();
            await activeTrip.save(); // Note: Record arrival below has its own atomic save

            // Find next pending stop
            const nextStopIndex = activeTrip.stops.findIndex(s => s.status === 'pending');

            if (nextStopIndex !== -1) {
                const nextStop = activeTrip.stops[nextStopIndex];

                // Haversine formula to check distance
                const toRad = x => x * Math.PI / 180;
                const R = 6371e3; // Earth radius in meters
                const dLat = toRad(nextStop.coordinates.latitude - latitude);
                const dLon = toRad(nextStop.coordinates.longitude - longitude);
                const lat1 = toRad(latitude);
                const lat2 = toRad(nextStop.coordinates.latitude);

                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c;

                // User Rule 3: Arrival only if inside geofence for 30–60 sec OR speed < 5 km/h
                // Note: The 30-60sec logic requires tracking consecutive GPS hits (stateful).
                // For this stateless controller, we use the secondary rule: speed < 5 km/h.
                if (distance <= (nextStop.geofenceRadius || 200)) {
                    // Inside geofence. Check speed rule.
                    if (parseFloat(speed) < 5) {
                        try {
                            // Record arrival automatically
                            await activeTrip.recordArrival(nextStopIndex, false, null, { latitude, longitude });
                        } catch (err) {
                            console.error("Failed to auto-record arrival:", err);
                        }
                    } else {
                        // Inside geofence but moving too fast. We would need a Redis cache or memory map 
                        // to track consecutive timestamps and trigger after 30s. 
                        // For now, < 5km/h triggers it. 
                    }
                }
            }
        }
        // ---------------------------------------------------------


        res.json({
            success: true,
            message: 'Location updated successfully',
            data: {
                busId: bus._id,
                currentLocation: bus.currentLocation
            }
        });

    } catch (error) {
        console.error('❌ Tracking update error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get live location for a bus
exports.getBusLocation = async (req, res) => {
    try {
        const { busId } = req.params;

        const bus = await Bus.findById(busId).select('currentLocation lastKnownLocation busNumber gpsDeviceId');

        if (!bus) {
            return res.status(404).json({
                success: false,
                message: 'Bus not found'
            });
        }

        // Return the most recent location data available
        const locationData = bus.lastKnownLocation || {
            coordinates: bus.currentLocation?.coordinates || [0, 0],
            timestamp: new Date(),
            speed: 0,
            heading: 0
        };

        res.json({
            success: true,
            data: {
                busId: bus._id,
                busNumber: bus.busNumber,
                deviceId: bus.gpsDeviceId,
                location: locationData
            }
        });

    } catch (error) {
        console.error('❌ Get location error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Resync endpoint for clients after WebSocket reconnection
exports.getTripState = async (req, res) => {
    try {
        const { tripId } = req.params;
        const TripTimeline = mongoose.model('TripTimeline');

        const trip = await TripTimeline.findById(tripId);

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip Timeline not found'
            });
        }

        res.json({
            success: true,
            data: trip
        });

    } catch (error) {
        console.error('❌ Resync error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
