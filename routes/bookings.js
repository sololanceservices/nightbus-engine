// ==================== routes/bookings.js ====================
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// Middleware to handle status vs ID routing
const statusOrIdRouter = (req, res, next) => {
  const { id } = req.params;
  const validStatuses = ['pending', 'confirmed', 'ongoing', 'completed', 'cancelled'];
  
  // Check if it's a valid MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(id)) {
    // It's an ID, proceed to getBookingDetails
    return bookingController.getBookingDetails(req, res);
  } else if (validStatuses.includes(id)) {
    // It's a status, treat it as such
    req.params.status = id;
    return bookingController.getBookingsByStatus(req, res);
  } else {
    // Invalid format
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid booking ID or status' 
    });
  }
};

// Protected routes
router.post('/', auth.verifyToken, bookingController.createBooking);
router.get('/:id', auth.verifyToken, statusOrIdRouter);
router.get('/user/:userId', auth.verifyToken, bookingController.getUserBookings);
router.put('/:id/cancel', auth.verifyToken, bookingController.cancelBooking);
router.get('/:id/qr-code', auth.verifyToken, bookingController.getQRCode);
router.post('/:id/panic', auth.verifyToken, bookingController.triggerPanic);

module.exports = router;
