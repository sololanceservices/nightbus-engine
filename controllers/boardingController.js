// ==================== controllers/boardingController.js ====================
const Segment = require('../models/Segment');
const Journey = require('../models/Journey');
const Bus = require('../models/Bus');
const User = require('../models/User');
const { sendNotification } = require('../utils/notifications');

/**
 * BOARDING PROCESS
 * 1. Staff scans QR code
 * 2. System validates segment
 * 3. Marks as "boarded"
 * 4. Updates journey status
 * 5. Sends notifications
 */

/**
 * Scan QR Code and Board Passenger
 */
exports.scanQRAndBoard = async (req, res) => {
  try {
    const { userId, role } = req.user; // Staff/Conductor
    const { qrData, busId, location } = req.body;

    // Validate staff role
    if (!['staff', 'owner'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only staff/conductors can scan QR codes'
      });
    }

    // Parse QR data
    let qrInfo;
    try {
      qrInfo = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code format'
      });
    }

    const { segmentId, journeyId, seatNumber, from, to, date } = qrInfo;

    if (!segmentId || !journeyId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid QR code data'
      });
    }

    // Get segment
    const segment = await Segment.findById(segmentId)
      .populate('busId routeId')
      .populate('journeyId');

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Validate bus (staff can only scan for their assigned bus)
    if (busId && segment.busId._id.toString() !== busId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This ticket is for a different bus'
      });
    }

    // Check if already boarded
    if (segment.status === 'boarded') {
      return res.status(400).json({
        success: false,
        message: 'Passenger already boarded',
        segment: {
          seatNumber: segment.seatNumber,
          boardedAt: segment.boardedAt,
          status: segment.status
        }
      });
    }

    // Check if segment is confirmed
    if (segment.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Ticket status: ${segment.status}. Cannot board.`,
        status: segment.status
      });
    }

    // Check if it's the correct travel date
    const today = new Date().toDateString();
    const travelDate = new Date(segment.travelDate).toDateString();

    if (today !== travelDate) {
      return res.status(400).json({
        success: false,
        message: 'Ticket is not valid for today',
        travelDate: segment.travelDate
      });
    }

    // Check if already completed or cancelled
    if (['completed', 'cancelled'].includes(segment.status)) {
      return res.status(400).json({
        success: false,
        message: `Ticket is ${segment.status}`
      });
    }

    // Update segment to boarded
    segment.status = 'boarded';
    segment.boardedAt = new Date();
    segment.boardedBy = userId;
    segment.qrCodeScanned = true;
    segment.qrCodeScanCount += 1;
    segment.lastQRScanAt = new Date();

    if (location) {
      segment.boardingLocation = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude]
      };
    }

    await segment.save();

    // Update journey status if this is the first segment
    const journey = await Journey.findById(journeyId).populate('segments');

    if (journey && journey.status === 'confirmed') {
      // Check if any segment is boarded
      const hasBoarded = journey.segments.some(s =>
        s._id.toString() === segmentId || s.status === 'boarded'
      );

      if (hasBoarded) {
        journey.status = 'boarded';
        await journey.save();
      }
    }

    // Send notification to customer
    await sendNotification(segment.journeyId.customerId, {
      title: 'Boarding Confirmed ✅',
      body: `You've boarded ${segment.busId.busNumber}. Seat: ${segment.seatNumber}`,
      type: 'boarding_confirmed',
      data: {
        segmentId: segment._id,
        journeyId: journey._id,
        seatNumber: segment.seatNumber,
        busNumber: segment.busId.busNumber
      }
    });

    // Generate exit OTP for this segment
    const exitOTP = segment.generateExitOTP();
    await segment.save();

    // Return success
    res.json({
      success: true,
      message: 'Passenger boarded successfully',
      segment: {
        id: segment._id,
        seatNumber: segment.seatNumber,
        passengerName: journey.customerId?.name,
        from: segment.fromStop.name,
        to: segment.toStop.name,
        boardedAt: segment.boardedAt,
        status: segment.status,
        exitOTP // Show to conductor for later verification
      },
      journey: {
        id: journey._id,
        status: journey.status,
        totalSegments: journey.segments.length,
        boardedSegments: journey.segments.filter(s => s.status === 'boarded').length
      }
    });

  } catch (error) {
    console.error('[BOARDING ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Verify Exit OTP and Complete Journey Segment
 */
exports.verifyExitOTP = async (req, res) => {
  try {
    const { userId } = req.user; // Staff/Conductor
    const { segmentId, otp } = req.body;

    if (!segmentId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID and OTP are required'
      });
    }

    const segment = await Segment.findById(segmentId)
      .populate('busId')
      .populate('journeyId');

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    // Check if boarded
    if (segment.status !== 'boarded') {
      return res.status(400).json({
        success: false,
        message: 'Passenger has not boarded yet'
      });
    }

    // Verify OTP
    const verification = segment.verifyExitOTP(otp);

    if (!verification.verified) {
      return res.status(400).json({
        success: false,
        message: verification.reason
      });
    }

    // Mark as completed
    segment.status = 'completed';
    segment.completedAt = new Date();
    segment.exitOTPVerifiedAt = new Date();
    segment.exitVerifiedBy = userId;
    await segment.save();

    // Check if all segments are completed
    const journey = await Journey.findById(segment.journeyId._id).populate('segments');

    const allCompleted = journey.segments.every(s =>
      s.status === 'completed' || s.status === 'cancelled'
    );

    if (allCompleted) {
      journey.status = 'completed';
      await journey.save();
    }

    // Send notification to customer
    await sendNotification(journey.customerId, {
      title: 'Journey Completed 🎉',
      body: `You've reached ${segment.toStop.name}. Thank you for traveling with us!`,
      type: 'journey_completed',
      data: {
        segmentId: segment._id,
        journeyId: journey._id
      }
    });

    res.json({
      success: true,
      message: 'Passenger alighted successfully',
      segment: {
        id: segment._id,
        seatNumber: segment.seatNumber,
        status: segment.status,
        completedAt: segment.completedAt
      },
      journey: {
        id: journey._id,
        status: journey.status,
        allCompleted
      }
    });

  } catch (error) {
    console.error('[EXIT OTP ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get Today's Passenger List for Bus
 */
exports.getTodaysPassengers = async (req, res) => {
  try {
    const { userId } = req.user;
    const { busId } = req.params;

    // Verify bus ownership/assignment
    const bus = await Bus.findById(busId);

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }

    // Check authorization
    const isAuthorized =
      bus.ownerId.toString() === userId.toString() ||
      bus.currentDriverId?.toString() === userId.toString() ||
      bus.currentConductorId?.toString() === userId.toString();

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this bus'
      });
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all segments for today
    const segments = await Segment.find({
      busId,
      travelDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: { $in: ['confirmed', 'boarded', 'completed'] }
    })
      .populate('journeyId')
      .populate('routeId', 'routeName')
      .sort({ seatNumber: 1 });

    // Group by status
    const confirmed = segments.filter(s => s.status === 'confirmed');
    const boarded = segments.filter(s => s.status === 'boarded');
    const completed = segments.filter(s => s.status === 'completed');

    res.json({
      success: true,
      bus: {
        id: bus._id,
        busNumber: bus.busNumber,
        totalSeats: bus.totalSeats
      },
      date: today.toISOString().split('T')[0],
      summary: {
        total: segments.length,
        confirmed: confirmed.length,
        boarded: boarded.length,
        completed: completed.length,
        pending: confirmed.length
      },
      passengers: segments.map(s => ({
        segmentId: s._id,
        seatNumber: s.seatNumber,
        passengerName: s.journeyId?.customerId?.name || 'Unknown',
        passengerPhone: s.journeyId?.customerId?.phone,
        from: s.fromStop.name,
        to: s.toStop.name,
        departureTime: s.departureTime,
        arrivalTime: s.arrivalTime,
        status: s.status,
        boardedAt: s.boardedAt,
        completedAt: s.completedAt,
        exitOTP: s.status === 'boarded' ? s.exitOTP : null,
        route: s.routeId?.routeName
      }))
    });

  } catch (error) {
    console.error('[GET PASSENGERS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get Boarding Statistics
 */
exports.getBoardingStats = async (req, res) => {
  try {
    const { busId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const stats = await Segment.aggregate([
      {
        $match: {
          busId: require('mongoose').Types.ObjectId(busId),
          travelDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$price' }
        }
      }
    ]);

    const totalBoarded = stats.find(s => s._id === 'boarded')?.count || 0;
    const totalCompleted = stats.find(s => s._id === 'completed')?.count || 0;
    const totalConfirmed = stats.find(s => s._id === 'confirmed')?.count || 0;

    res.json({
      success: true,
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      stats: {
        totalBoarded,
        totalCompleted,
        totalConfirmed,
        completionRate: totalBoarded > 0 ? Math.round((totalCompleted / totalBoarded) * 100) : 0,
        byStatus: stats
      }
    });

  } catch (error) {
    console.error('[STATS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Manual Board (without QR - emergency)
 */
exports.manualBoard = async (req, res) => {
  try {
    const { userId } = req.user;
    const { segmentId, reason } = req.body;

    const segment = await Segment.findById(segmentId).populate('journeyId busId');

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    if (segment.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Segment must be confirmed to board'
      });
    }

    segment.status = 'boarded';
    segment.boardedAt = new Date();
    segment.boardedBy = userId;
    segment.notes = `Manual boarding: ${reason || 'No QR scan'}`;
    await segment.save();

    const exitOTP = segment.generateExitOTP();
    await segment.save();

    res.json({
      success: true,
      message: 'Passenger boarded manually',
      segment: {
        id: segment._id,
        seatNumber: segment.seatNumber,
        status: segment.status,
        exitOTP
      }
    });

  } catch (error) {
    console.error('[MANUAL BOARD ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Bus Owner: Approve/Reject Seat Request
 */
exports.approveSeatRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { segmentId } = req.params;
    const { action, reason } = req.body; // action: 'approve' or 'reject'

    const segment = await Segment.findById(segmentId)
      .populate('busId')
      .populate('journeyId');

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    // Verify ownership
    if (segment.busId.ownerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (segment.status !== 'requested') {
      return res.status(400).json({
        success: false,
        message: 'Segment is not in requested state'
      });
    }

    if (action === 'approve') {
      segment.status = 'confirmed';
      await segment.save();

      // Notify customer
      await sendNotification(segment.journeyId.customerId, {
        title: 'Seat Confirmed! ✅',
        body: `Your seat ${segment.seatNumber} is confirmed for ${segment.fromStop.name} → ${segment.toStop.name}`,
        type: 'seat_confirmed',
        data: { segmentId: segment._id }
      });

      res.json({
        success: true,
        message: 'Seat approved',
        segment: {
          id: segment._id,
          seatNumber: segment.seatNumber,
          status: segment.status
        }
      });

    } else if (action === 'reject') {
      segment.status = 'rejected';
      segment.rejectedAt = new Date();
      segment.rejectedBy = userId;
      segment.rejectionReason = reason;
      await segment.save();

      // Process refund
      const Wallet = require('../models/Wallet');
      await Wallet.atomicRefund(segment.journeyId.customerId, segment.price, {
        transactionId: `RFD_${segmentId}_${Date.now()}`,
        reason: reason || 'Seat request rejected',
        bookingId: segment.journeyId._id,
        description: `Refund for rejected seat request: ${segment.seatNumber}`
      });

      // Notify customer
      await sendNotification(segment.journeyId.customerId, {
        title: 'Seat Request Rejected',
        body: `₹${segment.price} refunded to your wallet. Reason: ${reason || 'Not available'}`,
        type: 'seat_rejected',
        data: { segmentId: segment._id, refundAmount: segment.price }
      });

      res.json({
        success: true,
        message: 'Seat rejected and refund processed',
        segment: {
          id: segment._id,
          status: segment.status,
          refundAmount: segment.price
        }
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use approve or reject'
      });
    }

  } catch (error) {
    console.error('[APPROVE SEAT ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get boarding status for a bus
 */
exports.getBoardingStatus = async (req, res) => {
  try {
    const { busId } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const segments = await Segment.find({
      busId,
      travelDate: { $gte: today, $lt: tomorrow }
    });

    const summary = {
      total: segments.length,
      confirmed: segments.filter(s => s.status === 'confirmed').length,
      boarded: segments.filter(s => s.status === 'boarded').length,
      completed: segments.filter(s => s.status === 'completed').length,
      pending: segments.filter(s => s.status === 'requested').length
    };

    res.json({
      success: true,
      busId,
      date: today.toISOString().split('T')[0],
      summary,
      occupancyRate: summary.total > 0 ? Math.round((summary.boarded + summary.completed) / summary.total * 100) : 0
    });

  } catch (error) {
    console.error('[BOARDING STATUS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get pending approval requests for bus owner
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const { userId } = req.user;

    const buses = await Bus.find({ ownerId: userId }, '_id');
    const busIds = buses.map(b => b._id);

    const pendingSegments = await Segment.find({
      busId: { $in: busIds },
      status: 'requested'
    })
      .populate('journeyId')
      .populate('busId', 'busNumber')
      .populate('routeId', 'routeName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingSegments.length,
      segments: pendingSegments.map(seg => ({
        segmentId: seg._id,
        journeyId: seg.journeyId._id,
        busNumber: seg.busId.busNumber,
        route: seg.routeId.routeName,
        from: seg.fromStop.name,
        to: seg.toStop.name,
        seatNumber: seg.seatNumber,
        passengerName: seg.journeyId.customerId?.name,
        travelDate: seg.travelDate,
        price: seg.price,
        requestedAt: seg.createdAt
      }))
    });

  } catch (error) {
    console.error('[PENDING APPROVALS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk approve/reject seat requests
 */
exports.bulkApproveSeatRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const { segmentIds, action, reason } = req.body;

    if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Segment IDs array is required'
      });
    }

    const results = [];
    const Wallet = require('../models/Wallet');

    for (const segmentId of segmentIds) {
      try {
        const segment = await Segment.findById(segmentId)
          .populate('busId')
          .populate('journeyId');

        if (!segment || segment.busId.ownerId.toString() !== userId.toString()) {
          results.push({ segmentId, success: false, message: 'Unauthorized or not found' });
          continue;
        }

        if (action === 'approve') {
          segment.status = 'confirmed';
          await segment.save();

          await sendNotification(segment.journeyId.customerId, {
            title: 'Seat Confirmed! ✅',
            body: `Seat ${segment.seatNumber} confirmed`,
            type: 'seat_confirmed',
            data: { segmentId }
          });

          results.push({ segmentId, success: true, action: 'approved' });

        } else if (action === 'reject') {
          segment.status = 'rejected';
          segment.rejectedAt = new Date();
          segment.rejectedBy = userId;
          segment.rejectionReason = reason;
          await segment.save();

          await Wallet.atomicRefund(segment.journeyId.customerId, segment.price, {
            transactionId: `RFD_${segmentId}_${Date.now()}`,
            reason: reason || 'Seat rejected',
            bookingId: segment.journeyId._id,
            description: `Bulk refund for rejected seat: ${segment.seatNumber}`
          });

          await sendNotification(segment.journeyId.customerId, {
            title: 'Seat Request Rejected',
            body: `₹${segment.price} refunded. ${reason || ''}`,
            type: 'seat_rejected',
            data: { segmentId }
          });

          results.push({ segmentId, success: true, action: 'rejected' });
        }

      } catch (error) {
        results.push({ segmentId, success: false, message: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${segmentIds.length} requests`,
      results
    });

  } catch (error) {
    console.error('[BULK APPROVE ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generate exit OTP manually
 */
exports.generateExitOTP = async (req, res) => {
  try {
    const { segmentId } = req.body;

    const segment = await Segment.findById(segmentId);

    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    if (segment.status !== 'boarded') {
      return res.status(400).json({
        success: false,
        message: 'Can only generate OTP for boarded segments'
      });
    }

    const otp = segment.generateExitOTP();
    await segment.save();

    res.json({
      success: true,
      segmentId,
      exitOTP: otp,
      message: 'Exit OTP generated'
    });

  } catch (error) {
    console.error('[GENERATE OTP ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Resend exit OTP
 */
exports.resendExitOTP = async (req, res) => {
  try {
    const { segmentId } = req.body;

    const segment = await Segment.findById(segmentId).populate('journeyId');

    if (!segment || !segment.exitOTP) {
      return res.status(404).json({
        success: false,
        message: 'OTP not found. Generate OTP first.'
      });
    }

    await sendNotification(segment.journeyId.customerId, {
      title: 'Exit OTP',
      body: `Your exit OTP is: ${segment.exitOTP}`,
      type: 'general',
      data: { segmentId, exitOTP: segment.exitOTP }
    });

    res.json({
      success: true,
      message: 'OTP resent to customer'
    });

  } catch (error) {
    console.error('[RESEND OTP ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get customer's segments for journey
 */
exports.getMySegments = async (req, res) => {
  try {
    const { userId } = req.user;
    const { journeyId } = req.params;

    const journey = await Journey.findById(journeyId).populate('segments');

    if (!journey || journey.customerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({
      success: true,
      journey: {
        id: journey._id,
        status: journey.status
      },
      segments: journey.segments
    });

  } catch (error) {
    console.error('[GET MY SEGMENTS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get segment details
 */
exports.getSegmentDetails = async (req, res) => {
  try {
    const { segmentId } = req.params;

    const segment = await Segment.findById(segmentId)
      .populate('busId', 'busNumber busType')
      .populate('routeId', 'routeName')
      .populate('journeyId');

    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    res.json({ success: true, segment });

  } catch (error) {
    console.error('[SEGMENT DETAILS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get route analytics
 */
exports.getRouteAnalytics = async (req, res) => {
  try {
    const { routeId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const segments = await Segment.find({
      routeId,
      travelDate: { $gte: start, $lte: end }
    });

    const analytics = {
      totalBookings: segments.length,
      confirmed: segments.filter(s => s.status === 'confirmed').length,
      boarded: segments.filter(s => s.status === 'boarded').length,
      completed: segments.filter(s => s.status === 'completed').length,
      cancelled: segments.filter(s => s.status === 'cancelled').length,
      rejected: segments.filter(s => s.status === 'rejected').length,
      totalRevenue: segments.reduce((sum, s) => sum + (s.price || 0), 0),
      averagePrice: segments.length > 0 ? segments.reduce((sum, s) => sum + s.price, 0) / segments.length : 0,
      completionRate: segments.length > 0 ? Math.round((segments.filter(s => s.status === 'completed').length / segments.length) * 100) : 0
    };

    res.json({ success: true, routeId, period: { start, end }, analytics });

  } catch (error) {
    console.error('[ROUTE ANALYTICS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get daily report
 */
exports.getDailyReport = async (req, res) => {
  try {
    const { busId } = req.params;
    const { date } = req.query;

    const reportDate = date ? new Date(date) : new Date();
    reportDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const segments = await Segment.find({
      busId,
      travelDate: { $gte: reportDate, $lt: nextDay }
    }).populate('journeyId');

    const report = {
      date: reportDate.toISOString().split('T')[0],
      busId,
      totalPassengers: segments.length,
      boarded: segments.filter(s => s.status === 'boarded').length,
      completed: segments.filter(s => s.status === 'completed').length,
      noShows: segments.filter(s => s.status === 'no-show').length,
      revenue: segments.reduce((sum, s) => sum + s.price, 0),
      passengers: segments.map(s => ({
        name: s.journeyId?.customerId?.name,
        seatNumber: s.seatNumber,
        from: s.fromStop.name,
        to: s.toStop.name,
        status: s.status,
        boardedAt: s.boardedAt,
        completedAt: s.completedAt
      }))
    };

    res.json({ success: true, report });

  } catch (error) {
    console.error('[DAILY REPORT ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark passenger as no-show
 */
exports.markNoShow = async (req, res) => {
  try {
    const { segmentId, reason } = req.body;

    const segment = await Segment.findById(segmentId);

    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    segment.status = 'no-show';
    segment.notes = `No-show: ${reason || 'Passenger did not board'}`;
    await segment.save();

    res.json({
      success: true,
      message: 'Passenger marked as no-show',
      segment: { id: segment._id, status: segment.status }
    });

  } catch (error) {
    console.error('[MARK NO-SHOW ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Emergency complete journey
 */
exports.emergencyComplete = async (req, res) => {
  try {
    const { segmentId, reason } = req.body;

    const segment = await Segment.findById(segmentId);

    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    segment.status = 'completed';
    segment.completedAt = new Date();
    segment.notes = `Emergency completed: ${reason}`;
    await segment.save();

    res.json({
      success: true,
      message: 'Journey completed (emergency)',
      segment: { id: segment._id, status: segment.status }
    });

  } catch (error) {
    console.error('[EMERGENCY COMPLETE ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Validate QR code
 */
exports.validateQRCode = async (req, res) => {
  try {
    const { qrData } = req.body;

    let qrInfo;
    try {
      qrInfo = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid QR format' });
    }

    const { segmentId, journeyId } = qrInfo;

    const segment = await Segment.findById(segmentId).populate('journeyId busId');

    if (!segment) {
      return res.json({
        success: false,
        valid: false,
        message: 'Segment not found'
      });
    }

    const validation = {
      valid: true,
      segmentId: segment._id,
      journeyId: segment.journeyId._id,
      status: segment.status,
      busNumber: segment.busId.busNumber,
      seatNumber: segment.seatNumber,
      from: segment.fromStop.name,
      to: segment.toStop.name,
      travelDate: segment.travelDate,
      canBoard: segment.status === 'confirmed',
      warnings: []
    };

    if (segment.status !== 'confirmed') {
      validation.warnings.push(`Segment status is ${segment.status}`);
    }

    const today = new Date().toDateString();
    const travelDate = new Date(segment.travelDate).toDateString();
    if (today !== travelDate) {
      validation.warnings.push('Travel date does not match today');
    }

    res.json({ success: true, validation });

  } catch (error) {
    console.error('[VALIDATE QR ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  scanQRAndBoard: exports.scanQRAndBoard,
  verifyExitOTP: exports.verifyExitOTP,
  getTodaysPassengers: exports.getTodaysPassengers,
  getBoardingStats: exports.getBoardingStats,
  manualBoard: exports.manualBoard,
  approveSeatRequest: exports.approveSeatRequest,
  getBoardingStatus: exports.getBoardingStatus,
  getPendingApprovals: exports.getPendingApprovals,
  bulkApproveSeatRequests: exports.bulkApproveSeatRequests,
  generateExitOTP: exports.generateExitOTP,
  resendExitOTP: exports.resendExitOTP,
  getMySegments: exports.getMySegments,
  getSegmentDetails: exports.getSegmentDetails,
  getRouteAnalytics: exports.getRouteAnalytics,
  getDailyReport: exports.getDailyReport,
  markNoShow: exports.markNoShow,
  emergencyComplete: exports.emergencyComplete,
  validateQRCode: exports.validateQRCode
};