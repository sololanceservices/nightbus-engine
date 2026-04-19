// ==================== routes/reviewRoutes.js ====================
const express = require('express');
const router = express.Router();
const { submitReview, getProviderRating } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', submitReview);
router.get('/provider/:providerId', getProviderRating);

module.exports = router;
