// ==================== routes/foodRoutes.js ====================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../uploads/food');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'food-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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
  toggleFoodVendorStatus,
  getVendorItems,
  updateVendorItem,
  deleteVendorItem,
  uploadFoodImages,
  getVendorDashboardStats
} = require('../controllers/foodController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Customer endpoints
router.get('/vendors', getVendors);
router.post('/orders', createOrder);
router.get('/orders/my', getUserOrders);
router.get('/orders/:id', getFoodOrderDetails);
router.put('/orders/:id/cancel', cancelOrderUser);

// Vendor endpoints
router.post('/vendor/upload-images', upload.array('images', 5), uploadFoodImages);
router.get('/vendor/items', getVendorItems);
router.post('/vendor/items', addVendorItem);
router.put('/vendor/items/:id', updateVendorItem);
router.delete('/vendor/items/:id', deleteVendorItem);

router.get('/vendor/orders', getVendorOrders);
router.post('/vendor/register', registerFoodVendor);
router.get('/vendor/profile', getFoodVendorProfile);
router.put('/vendor/profile', updateFoodVendorProfile);
router.put('/vendor/status', toggleFoodVendorStatus);
router.get('/vendor/stats', getVendorDashboardStats);
router.put('/orders/:id/status', updateOrderStatus);

module.exports = router;
