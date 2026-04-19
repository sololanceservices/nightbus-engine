// ==================== routes/journeys.js ====================
const express = require('express');
const router = express.Router();
const journeyController = require('../controllers/journeyController');
const auth = require('../middleware/auth');

// Public routes
router.post('/search', journeyController.searchJourneys);
router.post('/calculate-price', journeyController.calculatePrice);
router.post('/booked-seats', journeyController.getBookedSeats);
router.post('/recommendations', journeyController.getRecommendations);

// Protected routes
router.get('/:id', auth.verifyToken, journeyController.getJourneyById);
router.get('/user/:userId', auth.verifyToken, journeyController.getUserJourneys);

module.exports = router;