// ==================== routes/foodRoutes.js ====================
const express = require('express');
const router = express.Router();
const { 
  getVendors,
  createOrder,
  getUserOrders,
  getFoodOrderDetails,
  updateOrderStatus,
  cancelOrderUser,
  addVendorItem,
  getVendorOrders,
  registerFoodVendor,
  updateFoodVendorProfile,
  getFoodVendorProfile,
  toggleFoodVendorStatus
} = require('../controllers/foodController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Customer endpoints
router.get('/vendors', getVendors);
router.post('/orders', createOrder);
router.get('/orders/my', getUserOrders);
router.get('/orders/:id', getFoodOrderDetails);
router.put('/orders/:id/cancel', cancelOrderUser);

// Vendor endpoints (Can restrict these with role middleware later)
router.post('/vendor/items', addVendorItem);
router.get('/vendor/orders', getVendorOrders);
router.post('/vendor/register', registerFoodVendor);
router.get('/vendor/profile', getFoodVendorProfile);
router.put('/vendor/profile', updateFoodVendorProfile);
router.put('/vendor/status', toggleFoodVendorStatus);
router.put('/orders/:id/status', updateOrderStatus);

module.exports = router;
