// ==================== routes/users.js ====================
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// Protected routes - require authentication
router.get('/', auth.verifyToken, userController.getAllUsers);
router.get('/:id', auth.verifyToken, userController.getUserById);
router.put('/:id', auth.verifyToken, userController.updateUser);
router.delete('/:id', auth.verifyToken, auth.checkRole('admin'), userController.deleteUser);
router.get('/:id/bookings', auth.verifyToken, userController.getUserBookings);
router.get('/:id/transactions', auth.verifyToken, userController.getUserTransactions);

module.exports = router;
