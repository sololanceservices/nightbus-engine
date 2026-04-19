// ==================== routes/yatraRoutes.js ====================
const express = require('express');
const router = express.Router();
const yatraController = require('../controllers/yatraController');
const { protect } = require('../middleware/auth');

router.use(protect);

// ── Customer ─────────────────────────────────────────────────
router.get('/packages', yatraController.listPackages);
router.get('/packages/:id', yatraController.getPackageDetails);
router.post('/book', yatraController.bookPackage);
router.get('/my-bookings', yatraController.getMyBookings);
router.get('/bookings/:id', yatraController.getBookingDetails);
router.put('/bookings/:id/cancel', yatraController.cancelBooking);

// ── Owner ─────────────────────────────────────────────────────
router.post('/owner/packages', yatraController.createPackage);
router.get('/owner/packages', yatraController.getOwnerPackages);
router.put('/owner/packages/:id', yatraController.updatePackage);
router.delete('/owner/packages/:id', yatraController.deletePackage);
router.get('/owner/packages/:id/bookings', yatraController.getPackageBookings);

module.exports = router;
