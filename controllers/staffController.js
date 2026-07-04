// ==================== controllers/staffController.js ====================
const mongoose = require('mongoose');
const User = require('../models/User');
const TripTimeline = require('../models/TripTimeline');
const Segment = require('../models/Segment');
const Bus = require('../models/Bus');

const resolveSegment = async (segmentId) => {
  if (!segmentId) return null;
  
  if (mongoose.Types.ObjectId.isValid(segmentId)) {
    return await Segment.findById(segmentId);
  }
  
  // Clean query (e.g. BKABC123 -> abc123)
  const cleanId = segmentId.replace(/^(BK|YTR|#)/i, '').trim().toLowerCase();
  if (cleanId.length === 6) {
    return await Segment.findOne({
      $or: [
        {
          $expr: {
            $eq: [
              { $substrCP: [ { $toString: "$_id" }, 18, 6 ] },
              cleanId
            ]
          }
        },
        {
          $expr: {
            $eq: [
              { $substrCP: [ { $toString: "$journeyId" }, 18, 6 ] },
              cleanId
            ]
          }
        }
      ]
    });
  }
  return null;
};

/**
 * Get active trip for the staff member
 */
exports.getActiveTrip = async (req, res) => {
  try {
    const staffId = req.userId;
    const user = await User.findById(staffId);

    if (!user || user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Unauthorized staff access' });
    }

    const busId = user.assignedBus;
    if (!busId) {
      return res.status(404).json({ success: false, message: 'No bus assigned to this staff member' });
    }

    // Find the current active trip for this bus
    const trip = await TripTimeline.findOne({
      busId,
      status: { $in: ['boarding', 'running', 'paused'] }
    }).populate('routeId', 'routeName stops');

    if (!trip) {
      return res.status(404).json({ success: false, message: 'No active trip found for your bus' });
    }

    res.json({
      success: true,
      data: { trip }
    });

  } catch (error) {
    console.error('❌ Get active trip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verify Ticket / Boarding (QR Scan or OTP)
 */
exports.verifyBoarding = async (req, res) => {
  try {
    const staffId = req.userId;
    const { segmentId, otp, method = 'qr_scan', location } = req.body;

    const user = await User.findById(staffId);
    if (!user.permissions.get('verify_ticket') && !user.permissions.get('manage_boarding')) {
      return res.status(403).json({ success: false, message: 'Insufficient permission to verify tickets' });
    }

    const segment = await resolveSegment(segmentId);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const canBoard = segment.canBeBoarded();
    if (!canBoard.allowed) {
      return res.status(400).json({ success: false, message: canBoard.reason });
    }

    // Verify OTP if method is otp
    if (method === 'otp') {
      const verify = segment.verifyBoardingOTP(otp);
      if (!verify.success) {
        return res.status(400).json({ success: false, message: verify.message });
      }
    }

    // Mark as boarded
    await segment.markBoarded({
      staffId,
      staffName: user.name,
      staffRole: user.staffRole,
      method,
      location
    });

    res.json({
      success: true,
      message: 'Passenger boarded successfully',
      data: { segment }
    });

  } catch (error) {
    console.error('❌ Verify boarding error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verify Drop / Exit (OTP)
 */
exports.verifyDrop = async (req, res) => {
  try {
    const staffId = req.userId;
    const { segmentId, otp, location } = req.body;

    const user = await User.findById(staffId);
    if (!user.permissions.get('verify_drop')) {
      return res.status(403).json({ success: false, message: 'Insufficient permission to verify drop-off' });
    }

    const segment = await resolveSegment(segmentId);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (segment.status !== 'boarded') {
      return res.status(400).json({ success: false, message: 'Passenger is not marked as boarded' });
    }

    const verify = await segment.verifyExitOTP(otp, {
      staffId,
      staffName: user.name,
      location
    });

    if (!verify.success) {
      return res.status(400).json({ success: false, message: verify.message });
    }

    res.json({
      success: true,
      message: 'Passenger drop-off verified',
      data: { segment }
    });

  } catch (error) {
    console.error('❌ Verify drop error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manual Location Update (Stop arrival/departure)
 */
exports.updatePosition = async (req, res) => {
  try {
    const staffId = req.userId;
    const { tripId, stopIndex, location, isArrival = true } = req.body;

    const user = await User.findById(staffId);
    if (!user.permissions.get('update_location')) {
      return res.status(403).json({ success: false, message: 'Insufficient permission to update location' });
    }

    const trip = await TripTimeline.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Active trip not found' });
    }

    if (isArrival) {
      await trip.recordArrival(stopIndex, true, staffId, location);
    } else {
        // Record departure logic
        if (stopIndex < 0 || stopIndex >= trip.stops.length) {
            return res.status(400).json({ success: false, message: 'Invalid stop index' });
        }
        
        trip.stops[stopIndex].status = 'departed';
        await trip.logEvent('departed_from_stop', `Manually departed from ${trip.stops[stopIndex].name}`, staffId, location);
        await trip.save();
    }

    res.json({
      success: true,
      message: `Position updated: ${isArrival ? 'Arrived at' : 'Departed from'} stop`,
      data: { trip }
    });

    // 📣 Notify passengers (Top-Class Feature)
    const { sendTopicNotification } = require('../utils/notifications');
    const stopName = trip.stops[stopIndex]?.name || 'a station';
    const topic = `trip_${trip._id}`;
    
    sendTopicNotification(topic, {
      title: isArrival ? 'Bus Arrived' : 'Bus Departed',
      body: isArrival 
        ? `The bus has reached ${stopName}. Prepare if this is your stop!`
        : `The bus has left ${stopName} and is en-route to the next stop.`,
      type: 'trip_status_update',
      data: { tripId: trip._id, stopIndex }
    });
  } catch (error) {
    console.error('❌ Update position error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Trip Running Status
 */
exports.updateTripStatus = async (req, res) => {
    try {
        const staffId = req.userId;
        const { tripId, status, details } = req.body;

        const user = await User.findById(staffId);
        if (!user.permissions.get('op_controls')) {
            return res.status(403).json({ success: false, message: 'Insufficient permission for operational controls' });
        }

        const trip = await TripTimeline.findById(tripId);
        if (!trip) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        const validStatuses = ['boarding', 'running', 'paused', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        trip.status = status;
        await trip.logEvent(`trip_${status}`, details || `Trip status updated to ${status} by staff`, staffId);
        await trip.save();

        res.json({
            success: true,
            message: `Trip status updated to ${status}`,
            data: { trip }
        });

        // 📣 Broadcast Trip Lifecycle Update
        const { sendTopicNotification } = require('../utils/notifications');
        const topic = `trip_${trip._id}`;
        
        let notificationBody = `Trip status updated to ${status}`;
        if (status === 'boarding') notificationBody = "Boarding has started! Please be at the stop with your QR code.";
        if (status === 'running') notificationBody = "The bus has started its journey.";
        if (status === 'completed') notificationBody = "Journey completed. Thank you for traveling with Basondra!";

        sendTopicNotification(topic, {
            title: status.toUpperCase() + ' Status',
            body: notificationBody,
            type: 'trip_lifecycle_update',
            data: { tripId: trip._id, status }
        });

    } catch (error) {
        console.error('❌ Update trip status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Passenger Manifest for active trip
 */
exports.getPassengerManifest = async (req, res) => {
    try {
        const staffId = req.userId;
        const { tripId } = req.params;

        const user = await User.findById(staffId);
        // Any staff on the trip should be able to see the manifest
        
        const trip = await TripTimeline.findById(tripId);
        if (!trip) {
            return res.status(404).json({ success: false, message: 'Trip not found' });
        }

        // Fetch all confirmed/boarded segments for this journey and bus today
        const segments = await Segment.find({
            busId: trip.busId,
            travelDate: { 
                $gte: new Date(trip.serviceDate).setHours(0,0,0,0),
                $lt: new Date(trip.serviceDate).setHours(23,59,59,999)
            },
            status: { $in: ['confirmed', 'boarded', 'in_transit', 'completed'] }
        }).sort('fromStop.name');

        res.json({
            success: true,
            count: segments.length,
            data: { segments }
        });

    } catch (error) {
        console.error('❌ Get manifest error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get active incidents for the staff's assigned bus
 */
exports.getActiveIncidents = async (req, res) => {
  try {
    const staffId = req.userId;
    const user = await User.findById(staffId);
    if (!user || user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Unauthorized staff access' });
    }

    const busId = user.assignedBus;
    if (!busId) {
      return res.json({ success: true, incidents: [] });
    }

    const Incident = require('../models/Incident');
    const incidents = await Incident.find({
      busId,
      status: { $in: ['reported', 'investigating'] }
    }).sort('-createdAt').limit(5);

    res.json({ success: true, incidents });
  } catch (error) {
    console.error('❌ Get active incidents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};