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

// Admin
router.get('/admin', protect, getAdminHomeContent);
router.post('/banners', protect, createBanner);
router.delete('/banners/:id', protect, deleteBanner);
router.post('/featured', protect, createFeaturedDestination);
router.delete('/featured/:id', protect, deleteFeaturedDestination);

module.exports = router;
