// ==================== routes/buses.js ====================
const express = require('express');
const router = express.Router();
const busController = require('../controllers/busController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', busController.getAllBuses);
router.get('/:id', busController.getBusById);
router.get('/:id/seats', busController.getBusSeats);

// Protected routes - require owner role
router.post('/', auth.verifyToken, auth.checkRole('owner'), busController.createBus);
router.put('/:id', auth.verifyToken, auth.checkRole('owner'), busController.updateBus);
router.delete('/:id', auth.verifyToken, auth.checkRole('owner'), busController.deleteBus);
router.post('/:id/availability', auth.verifyToken, auth.checkRole('owner'), busController.updateAvailability);

module.exports = router;
