const crypto = require('crypto');
const PaymentOrder = require('../models/PaymentOrder');
const bookingService = require('../services/bookingService');
const Payment = require('../models/Payment');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a new Razorpay Order and store intent
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, bookingData, receipt } = req.body;
    const userId = req.userId || req.user?._id || req.user?.id;

    if (!amount || !bookingData) {
      return res.status(400).json({ success: false, message: 'Amount and bookingData are required' });
    }

    const orderReceipt = receipt || `order_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;

    // 1. Create order in Razorpay
    const options = {
      amount: Math.round(amount * 100),  // amount in the smallest currency unit
      currency: "INR",
      receipt: orderReceipt
    };

    const order = await razorpay.orders.create(options);

    // 2. Save intent to PaymentOrder for Webhook recovery
    await PaymentOrder.create({
      razorpayOrderId: order.id,
      userId,
      bookingData,
      status: 'pending'
    });

    res.json({
      success: true,
      order: order,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('[CREATE ORDER ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Razorpay Webhook Handler
 */
exports.handleWebhook = async (req, res) => {
  try {
    // Verify Razorpay webhook signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET; // Ensure you have this in .env if using webhooks
    const signature = req.headers['x-razorpay-signature'];
    
    // Validate signature
    const expectedSignature = crypto.createHmac('sha256', secret)
                                    .update(JSON.stringify(req.body))
                                    .digest('hex');

    if (expectedSignature !== signature) {
        return res.status(400).json({ status: 'error', message: 'Invalid signature' });
    }

    const event = req.body.event;
    console.log(`[WEBHOOK] Received Razorpay event: ${event}`);

    if (event === 'order.paid') {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      // Find the associated PaymentOrder
      const paymentOrder = await PaymentOrder.findOne({ razorpayOrderId: orderId });
      
      if (!paymentOrder) {
        console.warn(`[WEBHOOK] No PaymentOrder found for orderId: ${orderId}.`);
        return res.json({ status: 'ok', info: 'untracked_order' });
      }

      if (paymentOrder.status === 'completed') {
        return res.json({ status: 'ok', info: 'already_processed' });
      }

      // Finalize the booking idempotently
      await bookingService.finalizeBooking({
        userId: paymentOrder.userId,
        bookingData: paymentOrder.bookingData,
        paymentDetails: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId.toString()
        },
        paymentOrder
      });

      console.log(`[WEBHOOK] Successfully processed order: ${orderId}`);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verify Razorpay Payment (Client-side confirmation)
 */
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingData } = req.body;
        const userId = req.userId || req.user?._id || req.user?.id;

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                        .update(body.toString())
                                        .digest('hex');

        if (expectedSignature !== razorpay_signature) {
             return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Finalize the booking idempotently
        const result = await bookingService.finalizeBooking({
            userId,
            bookingData,
            paymentDetails: { 
                razorpay_order_id: razorpay_order_id, 
                razorpay_payment_id: razorpay_payment_id 
            }
        });

        res.json(result);
    } catch (error) {
        console.error('[VERIFY PAYMENT ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
