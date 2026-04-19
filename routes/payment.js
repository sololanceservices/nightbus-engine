// ==================== routes/payment.js ====================
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth'); // Assuming this exists for auth

// Create a new Razorpay order
router.post('/create-order', protect, paymentController.createOrder);

// Verify payment from client
router.post('/verify', protect, paymentController.verifyPayment);

// Razorpay Webhook (No JWT protect, verified by signature)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
