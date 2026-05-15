const express = require('express');
const router = express.Router();
const { 
  getHomeContent, 
  createBanner, 
  deleteBanner, 
  createFeaturedDestination, 
  deleteFeaturedDestination,
  getAdminHomeContent
} = require('../controllers/homeContentController');
const { protect } = require('../middleware/auth');

// Public
router.get('/', getHomeContent);

const multer = require('multer');
const upload = multer({ dest: 'uploads/temp/' });

// Admin
router.get('/admin', protect, getAdminHomeContent);
router.post('/upload', protect, upload.single('image'), require('../controllers/homeContentController').uploadHomeImage);
router.post('/banners', protect, createBanner);
router.put('/banners/:id', protect, require('../controllers/homeContentController').updateBanner);
router.delete('/banners/:id', protect, deleteBanner);
router.post('/featured', protect, createFeaturedDestination);
router.put('/featured/:id', protect, require('../controllers/homeContentController').updateFeaturedDestination);
router.delete('/featured/:id', protect, deleteFeaturedDestination);

module.exports = router;
