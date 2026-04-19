// ==================== models/PaymentOrder.js ====================
const mongoose = require('mongoose');

const paymentOrderSchema = new mongoose.Schema({
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingData: {
    segments: Array,
    totalAmount: Number,
    platformFee: Number,
    taxes: Number,
    paymentMethod: String
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'completed'],
    default: 'pending'
  },
  paymentId: String,
  error: String,
  attempts: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Auto-expire pending orders after 24 hours
paymentOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);
