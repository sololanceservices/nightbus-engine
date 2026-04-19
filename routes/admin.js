// ==================== routes/admin.js ====================
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

// Protected routes - admin only
router.use(auth.verifyToken, auth.checkRole('admin'));

router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingDetails);

router.get('/buses', adminController.getAllBuses);
router.get('/routes', adminController.getAllRoutes);

router.get('/analytics', adminController.getAnalytics);
router.get('/transactions', adminController.getTransactions);

router.post('/verify-vendor/:vendorId', adminController.verifyVendor);
router.post('/verify-owner/:ownerId', adminController.verifyOwner);

// New Production-Ready Admin Routes
router.patch('/users/:id/status', adminController.updateUserStatus); // block/unblock
router.patch('/providers/:providerId/approval', adminController.updateProviderApproval);

// Categories
router.get('/categories', adminController.getAllCategories);
router.post('/categories', adminController.addCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// ==================== GLOBAL COMMUNICATION ====================
router.post('/broadcast', adminController.sendGlobalBroadcast);
router.get('/announcements', adminController.getGlobalAnnouncements);

// ==================== DEPARTMENT OVERSIGHT ====================
// Finance
router.get('/settlements/all', adminController.getAllSettlements);
router.patch('/settlements/:id/status', adminController.updateSettlementStatus);

// Marketplace
router.get('/marketplace/products', adminController.getAllProducts);
router.patch('/marketplace/products/:productId/status', adminController.toggleProductStatus);

// Food
router.get('/food/stats', adminController.getGlobalFoodStats);

module.exports = router;

