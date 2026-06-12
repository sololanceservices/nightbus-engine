const mongoose = require('mongoose');
const TripTimeline = require('../models/TripTimeline');
const Route = mongoose.model('Route');
const Bus = mongoose.model('Bus');

// Initialize a new trip from Route
exports.startTrip = async (req, res) => {
    try {
        const { routeId, busId, tripNumber, serviceDate, driverId, conductorId } = req.body;

        if (!routeId || !busId || !serviceDate) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const route = await Route.findById(routeId);
        if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

        // Build stops from Route
        const stops = route.stops.map((rs, index) => {
            // Simplistic scheduling calculation for demonstration
            let scheduledArrival = new Date(serviceDate);
            if (rs.arrivalTime) {
                const [hours, minutes] = rs.arrivalTime.split(':');
                scheduledArrival.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }

            return {
                stopId: rs.name,
                name: rs.name,
                coordinates: {
                    latitude: rs.coordinates.latitude,
                    longitude: rs.coordinates.longitude
                },
                geofenceRadius: rs.geofenceRadius || 200,
                order: rs.sequence || index,
                scheduledArrival,
                status: 'pending'
            };
        });

        // Optional: Ensure this bus doesn't already have an overlapping active trip
        const activeTrip = await TripTimeline.findOne({
            busId,
            status: { $in: ['scheduled', 'boarding', 'running'] },
            serviceDate: new Date(serviceDate)
        });

        if (activeTrip && activeTrip.tripNumber === tripNumber) {
            return res.status(400).json({ success: false, message: 'Trip with this number already exists today for this bus.' });
        }

        const timeline = new TripTimeline({
            routeId,
            busId,
            tripNumber,
            serviceDate,
            driverId,
            conductorId,
            status: 'running',
            stops
        });

        await timeline.logEvent('trip_started', `Trip started by driver`, driverId);
        await timeline.save();

        // Notify any socket listeners that a trip started
        const io = req.app.get('io');
        if (io) {
            io.to(`bus_${busId}`).emit('tripUpdated', timeline);
        }

        res.status(201).json({ success: true, timeline });

    } catch (error) {
        console.error('Start Trip error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};



// Manual override of a stop
exports.manualOverrideStop = async (req, res) => {
    try {
        const { tripId, stopIndex, action, delayMinutes } = req.body;
        // Action could be 'arrive', 'depart', 'skip'

        const timeline = await TripTimeline.findById(tripId);
        if (!timeline) return res.status(404).json({ success: false, message: 'TripTimeline not found' });

        if (stopIndex < 0 || stopIndex >= timeline.stops.length) {
            return res.status(400).json({ success: false, message: 'Invalid stop index' });
        }

        const stop = timeline.stops[stopIndex];
        const userId = req.user ? req.user._id : null; // Assuming authentication middleware attaches user

        if (action === 'arrive') {
            await timeline.recordArrival(stopIndex, true, userId);
        } else if (action === 'skip') {
            stop.status = 'skipped';
            await timeline.logEvent('stop_skipped', `Stop ${stop.name} skipped manually`, userId);
        } else if (action === 'delay') {
            stop.delayMinutes = delayMinutes || 0;
            await timeline.logEvent('delay_updated', `Delay updated to ${delayMinutes} mins at stop ${stop.name}`, userId);
        }

        await timeline.save();
        res.json({ success: true, timeline });

    } catch (error) {
        console.error('Manual override error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get timeline for a bus on a specific date
exports.getTimeline = async (req, res) => {
    try {
        const { busId, serviceDate, status } = req.query;

        let query = {};
        if (busId) {
            query.busId = busId;
        } else if (req.userRole === 'owner') {
            // Filter by this owner's buses
            const ownerBuses = await Bus.find({ ownerId: req.userId }, '_id');
            const ownerBusIds = ownerBuses.map(b => b._id);
            query.busId = { $in: ownerBusIds };
        }
        
        if (serviceDate) query.serviceDate = new Date(serviceDate);
        if (status) query.status = status;

        const timelines = await TripTimeline.find(query)
            .populate('busId', 'busNumber busType')
            .populate('routeId', 'routeName');

        res.json({ success: true, timelines });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Get the currently active trip for an owner's bus
exports.getActiveTrip = async (req, res) => {
    try {
        // Simple logic: find the first trip with status 'running' or 'boarding'
        // In a real app, you might filter by the owner's buses
        const trip = await TripTimeline.findOne({
            status: { $in: ['running', 'boarding'] }
        })
            .populate('busId', 'busNumber busType')
            .populate('routeId', 'routeName stops')
            .sort('-createdAt');

        if (!trip) {
            return res.status(404).json({ success: false, message: 'No active trip found' });
        }

        res.json({ success: true, data: trip });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
