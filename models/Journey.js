// ==================== models/Journey.js ====================
const mongoose = require('mongoose');

const journeySchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  segments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment'
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    default: 0
  },
  taxes: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  promoCode: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'boarded', 'completed', 'cancelled'],
    default: 'pending'
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  // Payment details
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'card', 'upi', 'razorpay', 'cash']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  // Cancellation details
  cancellationDate: Date,
  cancellationReason: String,
  refundAmount: Number,
  refundPercentage: Number,
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'processed', 'failed'],
    default: 'none'
  },
  // Metadata
  deviceInfo: {
    platform: String,
    version: String,
    deviceId: String
  },
  ipAddress: String,
  bookingSource: {
    type: String,
    enum: ['app', 'web', 'api'],
    default: 'app'
  }
}, { 
  timestamps: true 
});

// Indexes
journeySchema.index({ customerId: 1, status: 1 });
journeySchema.index({ status: 1, createdAt: -1 });
journeySchema.index({ bookingDate: -1 });

// Virtual for booking reference
journeySchema.virtual('bookingRef').get(function() {
  return `BK${this._id.toString().slice(-6).toUpperCase()}`;
});

// Methods
journeySchema.methods.canBeCancelled = function() {
  if (['cancelled', 'completed'].includes(this.status)) {
    return { allowed: false, reason: 'Booking already ' + this.status };
  }
  
  if (this.status === 'boarded') {
    return { allowed: false, reason: 'Journey already started' };
  }
  
  return { allowed: true };
};

journeySchema.methods.calculateRefund = function() {
  // Get first segment's travel date
  if (!this.segments || this.segments.length === 0) {
    return { amount: 0, percentage: 0 };
  }
  
  // Assuming segments are populated
  const firstSegment = this.segments[0];
  const travelDate = new Date(firstSegment.travelDate);
  const now = new Date();
  const hoursUntilTravel = (travelDate - now) / (1000 * 60 * 60);
  
  if (hoursUntilTravel < 2) {
    return { amount: 0, percentage: 0, reason: 'Less than 2 hours before travel' };
  } else if (hoursUntilTravel < 24) {
    return { 
      amount: this.totalAmount * 0.5, 
      percentage: 50,
      reason: 'Less than 24 hours before travel'
    };
  } else {
    return { 
      amount: this.totalAmount, 
      percentage: 100,
      reason: 'More than 24 hours before travel'
    };
  }
};

module.exports = mongoose.model('Journey', journeySchema);