// ==================== routes/marketplaceRoutes.js ====================
const express = require('express');
const router = express.Router();
const {
  registerProvider,
  searchServices,
  createServiceRequest,
  getMatchingLeads,
  getMyProviderProfile,
  updateProviderCoverage,
  getAllProviders,
  updateProviderStatus,
  toggleProviderStatus,
  updateProviderProfile
} = require('../controllers/marketplaceController');
const { protect } = require('../middleware/auth');

router.use(protect); // Secure all routes for MVP

// Models A & B Customer endpoints
router.get('/services/search', searchServices);
router.post('/requests', createServiceRequest);

// Provider endpoints
router.post('/provider/register', registerProvider);
router.get('/provider/leads', getMatchingLeads);
router.get('/provider/profile', getMyProviderProfile);
router.put('/provider/coverage', updateProviderCoverage);
router.put('/provider/status', toggleProviderStatus);
router.put('/provider/profile', updateProviderProfile);

// Admin endpoints (Role enforcement simplified for MVP)
router.get('/admin/providers', getAllProviders);
router.put('/admin/providers/:id/status', updateProviderStatus);

module.exports = router;
