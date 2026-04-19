// ==================== routes/services.js ====================
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', serviceController.getAllServices);
router.get('/category/:categoryId', serviceController.getServicesByCategory);
router.get('/:id', serviceController.getServiceById);

// Protected routes - require vendor role
router.post('/', auth.verifyToken, auth.checkRole('vendor'), serviceController.createService);
router.put('/:id', auth.verifyToken, auth.checkRole('vendor'), serviceController.updateService);
router.delete('/:id', auth.verifyToken, auth.checkRole('vendor'), serviceController.deleteService);

module.exports = router;
