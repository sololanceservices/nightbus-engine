const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const trackingController = require('../controllers/trackingController');
const auth = require('../middleware/auth');

// Public telemetry tracking (existing logic)
router.get('/telemetry/:busId', telemetryController.getBusStatus);

// New advanced GPS tracking 
router.post('/update-location', trackingController.updateLocation); // Device hits this endpoint
router.get('/bus/:busId', trackingController.getBusLocation); // Frontend retrieves live bus context
router.get('/trip-state/:tripId', trackingController.getTripState); // WebSockets reconnection payload

module.exports = router;
