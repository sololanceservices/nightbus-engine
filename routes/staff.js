// ==================== routes/staffRoutes.js ====================
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { verifyToken, checkRole } = require('../middleware/auth');

// All staff routes require authentication and staff role
router.use(verifyToken);
router.use(checkRole(['staff']));

// Operational Routes
router.get('/active-trip', staffController.getActiveTrip);
router.get('/trip/:tripId/manifest', staffController.getPassengerManifest);
router.get('/active-incidents', staffController.getActiveIncidents);

router.post('/verify-boarding', staffController.verifyBoarding);
router.post('/verify-drop', staffController.verifyDrop);
router.post('/update-position', staffController.updatePosition);
router.post('/trip-status', staffController.updateTripStatus);

module.exports = router;