// ==================== routes/yatraRoutes.js ====================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const yatraController = require('../controllers/yatraController');
const { protect } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/yatra');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'yatra-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.use(protect);

// ── Customer ─────────────────────────────────────────────────
router.get('/packages', yatraController.listPackages);
router.get('/packages/:id', yatraController.getPackageDetails);
router.post('/book', yatraController.bookPackage);
router.get('/my-bookings', yatraController.getMyBookings);
router.get('/bookings/:id', yatraController.getBookingDetails);
router.put('/bookings/:id/cancel', yatraController.cancelBooking);

// ── Owner ─────────────────────────────────────────────────────
router.post('/owner/packages/upload-images', upload.array('images', 5), yatraController.uploadYatraImages);
router.post('/owner/packages', yatraController.createPackage);
router.get('/owner/packages', yatraController.getOwnerPackages);
router.put('/owner/packages/:id', yatraController.updatePackage);
router.delete('/owner/packages/:id', yatraController.deletePackage);
router.get('/owner/packages/:id/bookings', yatraController.getPackageBookings);

module.exports = router;
