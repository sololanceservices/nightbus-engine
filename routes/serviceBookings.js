// ==================== routes/serviceBookings.js ====================
const express = require('express');
const router = express.Router();
const serviceBookingController = require('../controllers/serviceBookingController');
const auth = require('../middleware/auth');

// Protected routes
router.post('/', auth.verifyToken, serviceBookingController.createServiceBooking);
router.get('/:id', auth.verifyToken, serviceBookingController.getServiceBookingById);
router.get('/customer/:customerId', auth.verifyToken, serviceBookingController.getCustomerServiceBookings);
router.put('/:id/cancel', auth.verifyToken, serviceBookingController.cancelServiceBooking);
router.put('/:id/complete', auth.verifyToken, auth.checkRole('vendor'), serviceBookingController.completeServiceBooking);

module.exports = router;
