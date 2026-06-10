// ==================== controllers/bookingController.js ====================
const Journey = require('../models/Journey');
const Segment = require('../models/Segment');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const { sendNotification } = require('../utils/notifications');
const { processPayment } = require('../utils/payment');
const bookingService = require('../services/bookingService');

/**
 * CREATE BOOKING
 * Supports: Wallet, Razorpay (Verification), UPI, Card
 * This is the unified entry point from the App.
 */
exports.createBooking = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id || req.user?.id;
    const { 
      segments, 
      totalAmount, 
      paymentMethod, 
      paymentDetails, 
      platformFee, 
      taxes,
      couponCode 
    } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const bookingData = { 
      segments, 
      totalAmount, 
      platformFee: platformFee || totalAmount * 0.02, 
      taxes: taxes || totalAmount * 0.05, 
      paymentMethod,
      promoCode: couponCode
    };

    console.log(`[BOOKING CONTROLLER] New booking request: ${paymentMethod} for user: ${userId}`);

    let result;
    const onlineMethods = ['razorpay', 'card', 'upi', 'online'];
    
    if (paymentMethod === 'wallet') {
      result = await bookingService.finalizeWalletBooking({ userId, bookingData });
    } else if (onlineMethods.includes(paymentMethod)) {
      if (!paymentDetails) {
        return res.status(400).json({ success: false, message: `Payment details required for ${paymentMethod}` });
      }
      
      result = await bookingService.finalizeBooking({
        userId,
        bookingData,
        paymentDetails
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    // Populate segments for the response
    if (result.success && result.journey) {
        result.journey = await Journey.findById(result.journey._id).populate('segments');
    }

    res.json(result);

  } catch (error) {
    console.error('[BOOKING CONTROLLER ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create booking'
    });
  }
};

/**
 * Get Booking Details
 */
exports.getBookingDetails = async (req, res) => {
  try {
    const booking = await Journey.findById(req.params.id)
      .populate({
        path: 'segments',
        populate: {
          path: 'busId routeId',
          select: 'busNumber busType routeName'
        }
      })
      .populate('customerId', 'name phone email')
      .populate('paymentId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('[GET BOOKING ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get Bookings By Status
 */
exports.getBookingsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const validStatuses = ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking status'
      });
    }

    const query = { status };

    if (req.user && req.user.role !== 'admin') {
      query.customerId = req.user._id;
    }

    const bookings = await Journey.find(query)
      .populate({
        path: 'segments',
        populate: {
          path: 'busId routeId',
          select: 'busNumber busType routeName'
        }
      })
      .populate('customerId', 'name phone email')
      .populate('paymentId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Journey.countDocuments(query);

    res.json({
      success: true,
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('[GET BOOKINGS BY STATUS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get User Bookings
 */
exports.getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit = 20, page = 1 } = req.query;

    const query = { customerId: userId };
    if (status) query.status = status;

    const bookings = await Journey.find(query)
      .populate({
        path: 'segments',
        populate: { path: 'busId', select: 'busNumber busType' }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Journey.countDocuments(query);

    res.json({
      success: true,
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('[GET USER BOOKINGS ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Cancel Booking with Refund
 */
exports.cancelBooking = async (req, res) => {
  try {
    const { id: bookingId } = req.params;
    const userId = req.userId || req.user?._id || req.user?.id;
    const { reason } = req.body;

    const booking = await Journey.findById(bookingId)
      .populate('segments')
      .populate('paymentId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.customerId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking already cancelled'
      });
    }

    if (['boarded', 'completed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel boarded or completed booking'
      });
    }

    const { amount: refundAmount, percentage: refundPercentage } = booking.calculateRefund();

    booking.status = 'cancelled';
    booking.cancellationReason = reason;
    booking.cancellationDate = new Date();
    booking.refundAmount = refundAmount;
    booking.refundPercentage = refundPercentage;
    await booking.save();

    await Segment.updateMany(
      { journeyId: bookingId },
      { status: 'cancelled' }
    );

    if (refundAmount > 0) {
      const transactionId = `RFD${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      await Wallet.atomicRefund(userId, refundAmount, {
        transactionId,
        reason: reason || 'Booking cancellation',
        bookingId: bookingId,
        description: `Refund for booking cancellation #${bookingId.toString().slice(-6).toUpperCase()} - ${refundPercentage}%`
      });

      await sendNotification(userId, {
        title: 'Booking Cancelled',
        body: `₹${refundAmount} (${refundPercentage}%) refunded to your wallet`,
        type: 'booking_cancelled',
        data: { bookingId, refundAmount }
      }).catch(err => console.log('Notification error:', err));
    } else {
      await sendNotification(userId, {
        title: 'Booking Cancelled',
        body: 'No refund applicable for late cancellation',
        type: 'booking_cancelled',
        data: { bookingId }
      }).catch(err => console.log('Notification error:', err));
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        refundAmount,
        refundPercentage
      }
    });

  } catch (error) {
    console.error('[CANCEL BOOKING ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get QR Code Data
 */
exports.getQRCode = async (req, res) => {
  try {
    const { id: bookingId } = req.params;
    const { segmentId } = req.query;

    const booking = await Journey.findById(bookingId).populate('segments');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (segmentId) {
      const segment = booking.segments.find(s => s._id.toString() === segmentId);

      if (!segment) {
        return res.status(404).json({
          success: false,
          message: 'Segment not found'
        });
      }

      const qrData = {
        segmentId: segment._id,
        journeyId: booking._id,
        bookingId: booking._id.toString().slice(-6).toUpperCase(),
        seatNumber: segment.seatNumber,
        from: segment.fromStop.name,
        to: segment.toStop.name,
        date: segment.travelDate,
        status: segment.status,
        timestamp: Date.now()
      };

      return res.json({
        success: true,
        qrData: JSON.stringify(qrData)
      });
    }

    const qrCodes = booking.segments.map(segment => ({
      segmentId: segment._id,
      qrData: JSON.stringify({
        segmentId: segment._id,
        journeyId: booking._id,
        bookingId: booking._id.toString().slice(-6).toUpperCase(),
        seatNumber: segment.seatNumber,
        from: segment.fromStop.name,
        to: segment.toStop.name,
        date: segment.travelDate,
        status: segment.status,
        timestamp: Date.now()
      })
    }));

    res.json({
      success: true,
      qrCodes
    });

  } catch (error) {
    console.error('[QR CODE ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Trigger Panic Alert
 */
exports.triggerPanic = async (req, res) => {
  try {
    const { id: bookingId } = req.params;
    const userId = req.userId || req.user?._id || req.user?.id;
    
    const booking = await Journey.findById(bookingId).populate('segments');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.customerId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    const activeSegment = booking.segments.find(s => ['confirmed', 'boarded', 'requested'].includes(s.status));
    if (!activeSegment) {
       return res.status(400).json({ success: false, message: 'No active travel segment found' });
    }

    const busId = activeSegment.busId;
    
    const Incident = require('../models/Incident');
    const incident = await Incident.create({
      busId,
      reportedBy: userId,
      type: 'medical',
      description: 'PASSENGER PANIC ALERT TRIGGERED',
      severity: 'critical',
      status: 'reported',
      location: { type: 'Point', coordinates: [0, 0] }
    });

    const StaffAssignment = require('../models/StaffAssignment');
    const assignments = await StaffAssignment.find({ busId, status: 'assigned' });
    
    for (const assignment of assignments) {
      await sendNotification(assignment.staffId, {
        title: '🚨 PASSENGER PANIC ALERT 🚨',
        body: 'A passenger has triggered an emergency panic alert!',
        type: 'panic_alert',
        data: { incidentId: incident._id, busId }
      }).catch(err => console.log('Notification error:', err));
    }

    res.json({ success: true, message: 'Panic alert triggered successfully', incident });

  } catch (error) {
    console.error('[PANIC ALERT ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = exports;