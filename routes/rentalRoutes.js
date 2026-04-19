// ==================== routes/rentalRoutes.js ====================
const express = require('express');
const router = express.Router();
const { 
  createRequest,
  getCustomerRequests,
  getMatchingRequestsForOwner,
  getMatchingOwnersForCustomer,
  closeRequest,
  addRouteConfig,
  getOwnerRouteConfigs,
  updateRouteConfig,
  deleteRouteConfig,
  addRentalService,
  getOwnerRentalServices,
  deleteRentalService,
  getOwnerLeads,
  updateLeadStatus
} = require('../controllers/rentalController');
const { protect } = require('../middleware/auth');
const { 
  rentalRequestValidation, 
  routeConfigValidation, 
  rentalServiceValidation 
} = require('../middleware/validation');

const noCache = (req, res, next) => {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
};

router.use(protect);
router.use(noCache);

router.post('/', rentalRequestValidation, createRequest);
router.get('/customer', getCustomerRequests);
router.get('/owner/matching', getMatchingRequestsForOwner);
router.get('/:requestId/matching-owners', getMatchingOwnersForCustomer);
router.put('/:requestId/close', closeRequest);

// Owner Supply Endpoints - Route Config (Capability)
router.post('/route-config', routeConfigValidation, addRouteConfig);
router.get('/route-config', getOwnerRouteConfigs);
router.put('/route-config/:id', routeConfigValidation, updateRouteConfig);
router.delete('/route-config/:id', deleteRouteConfig);

// Owner Supply Endpoints - Rental Service (Availability)
router.post('/service', rentalServiceValidation, addRentalService);
router.get('/service/owner', getOwnerRentalServices);
// Lead Management (Matching Engine)
router.get('/owner/leads', getOwnerLeads);
router.put('/owner/leads/:leadId', updateLeadStatus);

router.delete('/service/:id', deleteRentalService);

module.exports = router;
