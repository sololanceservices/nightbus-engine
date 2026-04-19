// ==================== models/VendorOrder.js ====================
const mongoose = require('mongoose');

const vendorOrderSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment'
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus'
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },
  items: [{
    productId: mongoose.Schema.Types.ObjectId,
    name: String,
    quantity: Number,
    price: Number,
    notes: String
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  platformFee: Number,
  taxes: Number,
  specialRequests: String,
  orderTime: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "preparing", "ready", "delivered", "cancelled"],
    default: "pending"
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "held", "released", "refunded"],
    default: "pending"
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  acceptedAt: Date,
  readyAt: Date,
  deliveryTime: Date,
  deliveryCabinet: String, // e.g., "Seat 2B" for pickup location
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: String,
  ratedAt: Date,
  cancellationReason: String,
  rejectionReason: String
}, { timestamps: true });

vendorOrderSchema.index({ customerId: 1, createdAt: -1 });
vendorOrderSchema.index({ vendorId: 1, status: 1 });
vendorOrderSchema.index({ segmentId: 1 });
vendorOrderSchema.index({ busId: 1, orderTime: -1 });
vendorOrderSchema.index({ routeId: 1, status: 1 });

module.exports = mongoose.model('VendorOrder', vendorOrderSchema);
