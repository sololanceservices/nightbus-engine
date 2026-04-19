// ==================== routes/owner.js (COMPLETE) ====================
const express = require('express');
const router = express.Router();
const busOwnerController = require('../controllers/busOwnerController');
const auth = require('../middleware/auth');

// Apply authentication and owner role check to all routes
router.use(auth.verifyToken);
router.use((req, res, next) => {
  if (req.user.role !== 'owner' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Owner role required.'
    });
  }
  next();
});

// ==================== PING (DEBUG) ====================
router.get('/ping', (req, res) => res.json({ success: true, message: 'Owner API is alive 🚀' }));

// ==================== BUS MANAGEMENT ====================
router.post('/buses', busOwnerController.createBus);
router.get('/buses', busOwnerController.getOwnerBuses);
router.get('/buses/:busId/routes', busOwnerController.getBusRoutes); // Moved here
router.get('/buses/:busId', busOwnerController.getBusDetails);
router.put('/buses/:busId', busOwnerController.updateBus);
router.delete('/buses/:busId', busOwnerController.deleteBus);
router.put('/buses/:busId/seats/configure', busOwnerController.configureSeatPlatforms);
router.get('/buses/:busId/live-trip', busOwnerController.getLiveTrip);
router.get('/buses/:busId/history', busOwnerController.getBusTripHistory);

// ==================== ROUTE MANAGEMENT ====================
router.post('/routes', busOwnerController.createRoute);
router.get('/routes', busOwnerController.getOwnerRoutes);
router.get('/routes/:routeId/details', busOwnerController.getRouteDetails);
router.put('/routes/:routeId', busOwnerController.updateRoute);
router.put('/routes/:routeId/stops', busOwnerController.updateRouteStops);
router.delete('/routes/:routeId', busOwnerController.deleteRoute);

// ==================== BOOKING APPROVAL ====================
router.get('/pending-approvals', busOwnerController.getPendingApprovals);
router.put('/segments/:segmentId/approve', busOwnerController.approveBooking);
router.put('/segments/:segmentId/reject', busOwnerController.rejectBooking);

// ==================== STAFF MANAGEMENT ====================
router.get('/staff', busOwnerController.getOwnerStaff);
router.post('/staff', busOwnerController.createStaff);
router.put('/staff/:staffId', busOwnerController.updateStaff);
router.post('/staff/assign', busOwnerController.assignStaff);
router.get('/staff/:staffId/assignments', busOwnerController.getStaffAssignments);
router.put('/staff/:staffId/status', busOwnerController.updateStaffStatus);

// ==================== DASHBOARD & ANALYTICS ====================
router.get('/dashboard/stats', busOwnerController.getDashboardStats);
router.get('/analytics/revenue', busOwnerController.getRevenueAnalytics);
router.get('/analytics/transactions', busOwnerController.getRevenueTransactions);
router.get('/settlements', busOwnerController.getSettlements);
router.get('/journeys/upcoming', busOwnerController.getUpcomingJourneys);

// ==================== SETTINGS ====================
router.get('/settings', busOwnerController.getOwnerSettings);
router.put('/settings', busOwnerController.updateOwnerSettings);

// ==================== COMMUNICATION ====================
router.post('/announcement', busOwnerController.sendTripAnnouncement);

module.exports = router;


// // ==================== routes/owner.js (COMPLETE) ====================
// const express = require('express');
// const router = express.Router();
// const busOwnerController = require('../controllers/busOwnerController');
// const auth = require('../middleware/auth');

// // Apply authentication and owner role check to all routes
// router.use(auth.verifyToken);
// router.use((req, res, next) => {
//   if (req.user.role !== 'owner') {
//     return res.status(403).json({
//       success: false,
//       message: 'Access denied. Owner role required.'
//     });
//   }
//   next();
// });

// // Bus Management
// router.get('/buses', busOwnerController.getOwnerBuses);
// router.post('/buses', busOwnerController.createBus);
// router.get('/buses/:busId', busOwnerController.getBusDetails);
// router.put('/buses/:busId', busOwnerController.updateBus);
// router.delete('/buses/:busId', busOwnerController.deleteBus);

// // Route Management
// router.get('/routes', busOwnerController.getOwnerRoutes);
// router.post('/routes', busOwnerController.createRoute);
// router.put('/routes/:routeId', busOwnerController.updateRoute);
// router.delete('/routes/:routeId', busOwnerController.deleteRoute);
// router.get('/routes/:routeId/occupancy', busOwnerController.getRouteOccupancy);

// // Staff Management
// router.get('/staff', busOwnerController.getOwnerStaff);
// router.post('/staff/assign', busOwnerController.assignStaff);
// router.put('/staff/:staffId', busOwnerController.updateStaffStatus);
// router.get('/staff/:staffId/assignments', busOwnerController.getStaffAssignments);

// // Analytics & Dashboard
// router.get('/analytics/revenue', busOwnerController.getRevenueAnalytics);
// router.get('/journeys/upcoming', busOwnerController.getUpcomingJourneys);
// router.get('/dashboard/stats', busOwnerController.getDashboardStats);

// module.exports = router;

// // ==================== routes/busOwner.js ====================
// const express = require('express');
// const router = express.Router();
// const busOwnerController = require('../controllers/busOwnerController');
// const auth = require('../middleware/auth');

// // All routes require authentication and 'owner' role
// router.use(auth.verifyToken);
// router.use((req, res, next) => {
//   if (req.user.role !== 'owner') {
//     return res.status(403).json({ success: false, message: 'Only bus owners can access this' });
//   }
//   next();
// });

// /**
//  * ROUTE MANAGEMENT
//  */
// router.post('/routes', busOwnerController.createRoute);
// router.get('/routes', busOwnerController.getOwnerRoutes);
// router.put('/routes/:routeId', busOwnerController.updateRoute);
// router.delete('/routes/:routeId', busOwnerController.deleteRoute);

// /**
//  * BUS MANAGEMENT
//  */
// router.post('/buses', busOwnerController.createBus);
// router.get('/buses', busOwnerController.getOwnerBuses);
// router.put('/buses/:busId', busOwnerController.updateBus);

// /**
//  * ANALYTICS & REAL-TIME
//  */
// router.get('/routes/:routeId/occupancy', busOwnerController.getRouteOccupancy);
// router.get('/analytics/revenue', busOwnerController.getRevenueAnalytics);
// router.get('/journeys/upcoming', busOwnerController.getUpcomingJourneys);

// module.exports = router;
