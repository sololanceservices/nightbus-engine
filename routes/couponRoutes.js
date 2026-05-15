const express = require('express');
const router = express.Router();
const { 
  createCoupon, 
  getCoupons, 
  validateCoupon, 
  deleteCoupon,
  getActiveOffers
} = require('../controllers/couponController');
const { protect } = require('../middleware/auth');

router.get('/get-active', getActiveOffers);
router.post('/validate', protect, validateCoupon);

// Admin only routes
router.post('/', protect, createCoupon);
router.get('/', protect, getCoupons);
router.put('/:id', protect, require('../controllers/couponController').updateCoupon);
router.delete('/:id', protect, deleteCoupon);

module.exports = router;
