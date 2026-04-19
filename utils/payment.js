// ==================== utils/payment.js ====================
const Payment = require('../models/Payment');
const { v4: uuidv4 } = require('uuid');

/**
 * processPayment
 * Unified interface for processing payments
 */
exports.processPayment = async ({
    userId,
    amount,
    currency = 'INR',
    method = 'razorpay',
    description,
    metadata = {}
}) => {
    console.log(`💳 Processing ${method} payment: ₹${amount}`);

    // In a real app, you would switch based on method
    // and call the respective gateway API (Razorpay, Stripe, etc.)

    // SIMULATION: 90% Success Rate
    // To test failure, verifySystem.js can pass a specific flag or amount
    const isSimulation = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isSimulation) {
        return await simulateGateway(amount, method);
    }

    // TODO: Implement actual Razorpay/Stripe calls here
    throw new Error('Payment gateway not implemented in production mode yet');
};

/**
 * simulateGateway
 * Simulates a payment gateway response
 */
async function simulateGateway(amount, method) {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate success
            resolve({
                success: true,
                transactionId: `${method.toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                gatewayId: `g_${uuidv4().substring(0, 10)}`,
                amount,
                method,
                status: 'completed',
                rawResponse: { simulated: true }
            });
        }, 1000); // 1s delay
    });
}

/**
 * refundPayment
 * Process refund via gateway
 */
exports.refundPayment = async (paymentId, amount) => {
    console.log(`↩️ Refund initiated for payment: ${paymentId}, Amount: ₹${amount}`);

    // Simulate refund
    return {
        success: true,
        refundId: `ref_${uuidv4()}`,
        status: 'processed'
    };
};

module.exports = exports;
