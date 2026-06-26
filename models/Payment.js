// ==================== models/Payment.js ====================
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey'
  },
  serviceBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceBooking'
  },
  amount: {
    type: Number,
    required: true
  },
  platformFee: Number,
  taxes: Number,
  gateway: {
    type: String,
    enum: ["razorpay", "cashfree", "stripe", "paypal", "cash", "wallet", "test"],
    default: "razorpay"
  },
  gatewayId: String, // Razorpay payment_id
  orderId: String,   // Razorpay order_id
  status: {
    type: String,
    enum: ["pending", "authorized", "captured", "failed", "refunded"],
    default: "pending"
  },
  method: {
    type: String,
    enum: ["card", "upi", "wallet", "netbanking", "cash"],
    required: true
  },
  escrowAmount: Number,
  escrowReleasedAt: Date,
  refundId: String,
  refundAmount: Number,
  refundReason: String,
  failureReason: String,
  customerEmail: String,
  customerPhone: String,
  ipAddress: String
}, { timestamps: true });

paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ gatewayId: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
