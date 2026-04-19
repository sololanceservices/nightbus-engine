// ==================== routes/orders.js ====================
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Protected routes
router.post('/', auth.verifyToken, orderController.createOrder);
router.get('/:id', auth.verifyToken, orderController.getOrderById);
router.get('/customer/:customerId', auth.verifyToken, orderController.getCustomerOrders);
router.put('/:id', auth.verifyToken, orderController.updateOrder);
router.put('/:id/cancel', auth.verifyToken, orderController.cancelOrder);

module.exports = router;
