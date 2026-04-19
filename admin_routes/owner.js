
// ==================== routes/owner.js (COMPLETE) ====================
const express = require('express');
const router = express.Router();
const busOwnerController = require('../controllers/busOwnerController');
const auth = require('../middleware/auth');

// Apply authentication and owner role check to all routes
router.use(auth.verifyToken);
router.use((req, res, next) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Owner role required.' 
    });
  }
  next();
});

// Bus Management
router.get('/buses', busOwnerController.getOwnerBuses);
router.post('/buses', busOwnerController.createBus);
router.get('/buses/:busId', busOwnerController.getBusDetails);
router.put('/buses/:busId', busOwnerController.updateBus);
router.delete('/buses/:busId', busOwnerController.deleteBus);

// Route Management
router.get('/routes', busOwnerController.getOwnerRoutes);
router.post('/routes', busOwnerController.createRoute);
router.put('/routes/:routeId', busOwnerController.updateRoute);
router.delete('/routes/:routeId', busOwnerController.deleteRoute);
router.get('/routes/:routeId/occupancy', busOwnerController.getRouteOccupancy);

// Staff Management
router.get('/staff', busOwnerController.getOwnerStaff);
router.post('/staff/assign', busOwnerController.assignStaff);
router.put('/staff/:staffId', busOwnerController.updateStaffStatus);
router.get('/staff/:staffId/assignments', busOwnerController.getStaffAssignments);

// Analytics & Dashboard
router.get('/analytics/revenue', busOwnerController.getRevenueAnalytics);
router.get('/journeys/upcoming', busOwnerController.getUpcomingJourneys);
router.get('/dashboard/stats', busOwnerController.getDashboardStats);

module.exports = router;
