const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const auth = require('../middleware/auth'); // Optionally use this

// Trip Management endpoints 
router.get('/active', tripController.getActiveTrip);
router.post('/start', tripController.startTrip);
router.post('/manual-override', tripController.manualOverrideStop);
router.get('/', tripController.getTimeline);

module.exports = router;
