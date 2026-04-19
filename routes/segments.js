
// =============== routes/segments.js ====================
const express = require('express');
const router = express.Router();
const segmentController = require('../controllers/segmentController');
const auth = require('../middleware/auth');

// Protected routes
router.get('/pending', auth.verifyToken, segmentController.getPendingSegments);
router.get('/:id([0-9a-fA-F]{24})', auth.verifyToken, segmentController.getSegmentById);
router.put('/:id/status', auth.verifyToken, auth.checkRole('owner'), segmentController.updateSegmentStatus);
router.get('/journey/:journeyId', auth.verifyToken, segmentController.getJourneySegments);

module.exports = router;
