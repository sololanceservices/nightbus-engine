// ==================== routes/routes.js ====================
const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', routeController.getAllRoutes);
router.get('/:id', routeController.getRouteById);
router.get('/schedule/:routeId', routeController.getSchedule);

// Protected routes - require owner role
router.post('/', auth.verifyToken, auth.checkRole('owner'), routeController.createRoute);
router.put('/:id', auth.verifyToken, auth.checkRole('owner'), routeController.updateRoute);
router.delete('/:id', auth.verifyToken, auth.checkRole('owner'), routeController.deleteRoute);
router.post('/:id/stops', auth.verifyToken, auth.checkRole('owner'), routeController.addStop);

module.exports = router;
