// ==================== models/Refund.js ====================
const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    enum: ["customer_request", "bus_cancelled", "seat_rejected", "dispute", "refund_policy", "payment_failed"],
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "initiated", "completed", "failed", "rejected"],
    default: "pending"
  },
  gatewayRefId: String, // Cashfree refund_id
  gatewayStatus: String,
  processedAt: Date,
  notes: String,
  refundedAmount: Number,
  bankTransactionId: String
}, { timestamps: true });

refundSchema.index({ customerId: 1, status: 1 });
refundSchema.index({ paymentId: 1 });
refundSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);
