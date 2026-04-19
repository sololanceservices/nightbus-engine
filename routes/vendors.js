// ==================== routes/vendors.js ====================
const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', vendorController.getAllVendors);
router.get('/:id', vendorController.getVendorById);

// Protected routes - require vendor role
router.get('/profile', auth.verifyToken, auth.checkRole('vendor'), vendorController.getVendorProfile);
router.put('/profile', auth.verifyToken, auth.checkRole('vendor'), vendorController.updateVendorProfile);
router.get('/analytics/:vendorId', auth.verifyToken, auth.checkRole('vendor'), vendorController.getAnalytics);
router.get('/orders/:vendorId', auth.verifyToken, auth.checkRole('vendor'), vendorController.getVendorOrders);
router.get('/items/:vendorId', auth.verifyToken, auth.checkRole('vendor'), vendorController.getVendorItems);
router.post('/items', auth.verifyToken, auth.checkRole('vendor'), vendorController.addVendorItem);

module.exports = router;
