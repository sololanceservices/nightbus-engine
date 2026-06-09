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
  updateProviderProfile,
  uploadLicenseImage,
  uploadFitnessImage,
  uploadInsuranceImage,
  uploadMechanicImage
} = require('../controllers/marketplaceController');
const { protect } = require('../middleware/auth');

const multer = require('multer');
const upload = multer({ dest: 'uploads/temp/' });

router.use(protect); // Secure all routes for MVP

// Models A & B Customer endpoints
router.get('/services/search', searchServices);
router.post('/requests', createServiceRequest);

// Provider endpoints
router.post('/provider/register', registerProvider);
router.post('/provider/upload-license', upload.single('licenseImage'), uploadLicenseImage);
router.post('/provider/upload-fitness', upload.single('fitnessImage'), uploadFitnessImage);
router.post('/provider/upload-insurance', upload.single('insuranceImage'), uploadInsuranceImage);
router.post('/provider/upload-mechanic', upload.single('mechanicImage'), uploadMechanicImage);
router.get('/provider/leads', getMatchingLeads);
router.get('/provider/profile', getMyProviderProfile);
router.put('/provider/coverage', updateProviderCoverage);
router.put('/provider/status', toggleProviderStatus);
router.put('/provider/profile', updateProviderProfile);

// Admin endpoints (Role enforcement simplified for MVP)
router.get('/admin/providers', getAllProviders);
router.put('/admin/providers/:id/status', updateProviderStatus);

module.exports = router;
