const Bus = require('../models/Bus');
const Telemetry = require('../models/Telemetry');
const aiService = require('../utils/aiService');

// In-memory cache for last telemetry to compare for AI analysis
// In production, use Redis
const lastTelemetryCache = {};

/**
 * Receive Telemetry Data from Device
 * POST /api/telemetry
 * Body: { busId, lat, lng, speed, fuel, battery, occupancy, ignition, ... }
 */
exports.receiveTelemetry = async (req, res) => {
    try {
        const { busId, lat, lng, speed, fuel, battery, occupancy, ignition } = req.body;
        const io = req.app.get('io'); // Get Socket.io instance

        if (!busId || !lat || !lng) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // 1. AI Analysis
        const previousData = lastTelemetryCache[busId];
        const aiStatus = await aiService.analyzeTelemetry(req.body, previousData);

        // Update Cache
        lastTelemetryCache[busId] = req.body;

        // 2. Update Bus Real-time State
        const updateData = {
            lastKnownLocation: {
                type: 'Point',
                coordinates: [lng, lat],
                timestamp: new Date(),
                speed: speed || 0,
                heading: req.body.heading || 0
            },
            currentLocation: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            fuelLevel: fuel,
            batteryLevel: battery,
            currentSpeed: speed,
            currentOccupancy: occupancy,
            lastHeartbeat: new Date(),
            aiStatus: aiStatus
        };

        const bus = await Bus.findByIdAndUpdate(busId, updateData, { new: true });

        if (!bus) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        // 3. Log History
        await Telemetry.create({
            busId,
            location: { type: 'Point', coordinates: [lng, lat] },
            speed,
            fuelLevel: fuel,
            batteryLevel: battery,
            occupancy,
            ignitionStatus: ignition,
            rawPayload: req.body
        });

        // 4. Emit Real-time Update via Socket.io
        if (io) {
            io.to(`bus-${busId}`).emit('bus_update', {
                busId,
                location: { latitude: lat, longitude: lng },
                speed,
                fuel,
                occupancy,
                aiStatus,
                lastUpdated: new Date()
            });
        }

        res.json({ success: true, message: 'Telemetry received', aiStatus });

    } catch (error) {
        console.error('❌ Telemetry Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * Get Bus Real-time Status (Public/Protected)
 * GET /api/tracking/bus/:busId
 */
exports.getBusStatus = async (req, res) => {
    try {
        const { busId } = req.params;

        const bus = await Bus.findById(busId)
            .select('busNumber busName currentLocation fuelLevel batteryLevel currentSpeed currentOccupancy aiStatus lastHeartbeat fuelType')
            .lean();

        if (!bus) {
            return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        res.json({ success: true, data: { bus } });
    } catch (error) {
        console.error('❌ Get Bus Status Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Telemetry History
 * GET /api/telemetry/:busId
 */
exports.getBusHistory = async (req, res) => {
    try {
        const { busId } = req.params;
        const { limit = 100 } = req.query;

        const history = await Telemetry.find({ busId })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, count: history.length, data: history });
    } catch (error) {
        console.error('❌ History Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
