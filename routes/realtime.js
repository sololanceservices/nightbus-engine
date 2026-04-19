// ==================== routes/realtime.js ====================
const express = require('express');
const router = express.Router();
const realtimeController = require('../controllers/realtimeController');
const auth = require('../middleware/auth');

// Real-time notification endpoints
router.post('/booking-confirmed', auth.verifyToken, realtimeController.notifyBookingConfirmed);
router.post('/bus-location', auth.verifyToken, auth.checkRole('owner'), realtimeController.notifyBusLocationUpdate);
router.post('/notification', auth.verifyToken, realtimeController.sendRealTimeNotification);

module.exports = router;
