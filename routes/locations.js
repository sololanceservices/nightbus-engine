const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const auth = require('../middleware/auth');

// Search locations with auto-suggestions (Optional auth to show private landmarks)
router.get('/search', auth.optionalProtect, locationController.searchLocations);

// Get popular locations
router.get('/popular', locationController.getPopularLocations);

// Create a new landmark (Requires auth)
router.post('/', auth.protect, locationController.createLocation);

// Parse speech input (for voice search)
router.post('/parse-speech', locationController.parseSpeech);

module.exports = router;