const Bus = require('../models/Bus');
const Telemetry = require('../models/Telemetry');
const aiService = require('../utils/aiService');
const FoodOrder = require('../models/FoodOrder');
const TripTimeline = require('../models/TripTimeline');

// Haversine formula to calculate distance in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

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

        // 5. Vendor Proximity Alerts
        try {
            // Find active trip timeline for this bus
            const activeJourney = await TripTimeline.findOne({ busId: bus._id, status: 'running' });
            if (activeJourney) {
                // Find accepted food orders for this journey that haven't had an alert sent
                const pendingFoodOrders = await FoodOrder.find({
                    journeyId: activeJourney._id,
                    status: 'accepted',
                    proximityAlertSent: false
                }).populate('vendorId');

                for (const order of pendingFoodOrders) {
                    if (order.vendorId && order.vendorId.location && order.vendorId.location.coordinates) {
                        const [vendorLng, vendorLat] = order.vendorId.location.coordinates;
                        const distance = getDistanceFromLatLonInKm(lat, lng, vendorLat, vendorLng);
                        
                        // If within 15km, alert vendor
                        if (distance <= 15) {
                            console.log(`🚀 Proximity Alert! Bus ${busId} is ${Math.round(distance)}km away from Vendor ${order.vendorId._id}`);
                            
                            // Emit alert via Socket.io to the specific vendor's channel
                            if (io) {
                                io.to(`vendor-${order.vendorId._id}`).emit('vendor_proximity_alert', {
                                    orderId: order._id,
                                    busId: busId,
                                    pnrNumber: order.pnrNumber,
                                    distanceKm: Math.round(distance),
                                    message: `The bus for Order #${order._id.toString().substring(0,6)} is approaching (approx ${Math.round(distance)} km away). Please start preparing!`
                                });
                            }
                            
                            // Mark order to prevent duplicate alerts
                            order.proximityAlertSent = true;
                            // Update status to preparing since the bus is close
                            order.status = 'preparing';
                            await order.save();
                        }
                    }
                }
            }
        } catch (alertError) {
            console.error('Error processing vendor proximity alerts:', alertError);
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
