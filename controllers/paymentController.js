const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentOrder = require('../models/PaymentOrder');
const bookingService = require('../services/bookingService');
const Payment = require('../models/Payment');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create a new Razorpay Order and store intent
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, bookingData, receipt } = req.body;
    const userId = req.userId;

    if (!amount || !bookingData) {
      return res.status(400).json({ success: false, message: 'Amount and bookingData are required' });
    }

    // 1. Create order in Razorpay
    const options = {
      amount: Math.round(amount * 100), // In paise
      currency: 'INR',
      receipt: receipt || `rcpt_${Date.now()}`
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
      order,
      key: process.env.RAZORPAY_KEY_ID // Send key for frontend
    });
  } catch (error) {
    console.error('[CREATE ORDER ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Razorpay Webhook Handler
 * Critical for production reliability (100k users scale)
 */
exports.handleWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  try {
    // 1. Verify Signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('[WEBHOOK] Invalid signature received');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body.event;
    console.log(`[WEBHOOK] Received event: ${event}`);

    // 2. Handle relevant events
    if (event === 'payment.captured' || event === 'order.paid') {
      const orderId = req.body.payload.payment.entity.order_id || req.body.payload.order.entity.id;
      const paymentId = req.body.payload.payment.entity.id;

      // Find the associated PaymentOrder
      const paymentOrder = await PaymentOrder.findOne({ razorpayOrderId: orderId });
      
      if (!paymentOrder) {
        console.warn(`[WEBHOOK] No PaymentOrder found for orderId: ${orderId}. Possibly manual payment or other service.`);
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
          razorpay_payment_id: paymentId
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
 * Verify Razorpay Signature (Client-side confirmation)
 */
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingData } = req.body;
        const secret = process.env.RAZORPAY_KEY_SECRET;
        const userId = req.userId;

        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Finalize the booking idempotently
        const result = await bookingService.finalizeBooking({
            userId,
            bookingData,
            paymentDetails: { razorpay_order_id, razorpay_payment_id }
        });

        res.json(result);
    } catch (error) {
        console.error('[VERIFY PAYMENT ERROR]', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

