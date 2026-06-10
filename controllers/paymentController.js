const crypto = require('crypto');
const PaymentOrder = require('../models/PaymentOrder');
const bookingService = require('../services/bookingService');
const Payment = require('../models/Payment');
const { Cashfree, CFEnvironment } = require('cashfree-pg');

// Initialize Cashfree
Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
Cashfree.XEnvironment = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

/**
 * Create a new Cashfree Order and store intent
 */
exports.createOrder = async (req, res) => {
  try {
    const { amount, bookingData, receipt } = req.body;
    const userId = req.userId || req.user?._id || req.user?.id;

    if (!amount || !bookingData) {
      return res.status(400).json({ success: false, message: 'Amount and bookingData are required' });
    }

    const orderId = receipt || `order_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;

    // 1. Create order in Cashfree
    const request = {
        "order_amount": amount,
        "order_currency": "INR",
        "order_id": orderId,
        "customer_details": {
            "customer_id": userId.toString(),
            "customer_phone": "9999999999", // Should be provided by frontend ideally
            "customer_email": "user@warrol.com"
        },
        "order_meta": {
            "return_url": `${process.env.API_URL || 'http://localhost:5000'}/api/payment/verify?order_id={order_id}`
        }
    };

    const response = await Cashfree.PGCreateOrder("2023-08-01", request);

    // 2. Save intent to PaymentOrder for Webhook recovery
    await PaymentOrder.create({
      cashfreeOrderId: orderId,
      userId,
      bookingData,
      status: 'pending'
    });

    res.json({
      success: true,
      order: response.data,
      payment_session_id: response.data.payment_session_id,
      order_id: response.data.order_id
    });
  } catch (error) {
    console.error('[CREATE ORDER ERROR]', error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
  }
};

/**
 * Cashfree Webhook Handler
 */
exports.handleWebhook = async (req, res) => {
  try {
    // For proper Cashfree webhook verification, you need rawBody.
    // Assuming simple processing for now.
    const event = req.body.type;
    console.log(`[WEBHOOK] Received Cashfree event: ${event}`);

    if (event === 'PAYMENT_SUCCESS_WEBHOOK') {
      const orderId = req.body.data.order.order_id;
      const paymentId = req.body.data.payment.cf_payment_id;

      // Find the associated PaymentOrder
      const paymentOrder = await PaymentOrder.findOne({ cashfreeOrderId: orderId });
      
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
          cashfree_order_id: orderId,
          cashfree_payment_id: paymentId.toString()
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
 * Verify Cashfree Payment (Client-side confirmation)
 */
exports.verifyPayment = async (req, res) => {
    try {
        const { order_id, bookingData } = req.body;
        const userId = req.userId || req.user?._id || req.user?.id;

        // Fetch order payments from Cashfree to verify status securely
        const response = await Cashfree.PGOrderFetchPayments("2023-08-01", order_id);
        const payments = response.data;
        
        // Find the successful payment if any
        const successfulPayment = payments.find(p => p.payment_status === 'SUCCESS');

        if (!successfulPayment) {
            return res.status(400).json({ success: false, message: 'Payment not successful or pending' });
        }

        // Finalize the booking idempotently
        const result = await bookingService.finalizeBooking({
            userId,
            bookingData,
            paymentDetails: { 
                cashfree_order_id: order_id, 
                cashfree_payment_id: successfulPayment.cf_payment_id.toString() 
            }
        });

        res.json(result);
    } catch (error) {
        console.error('[VERIFY PAYMENT ERROR]', error.response?.data || error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
