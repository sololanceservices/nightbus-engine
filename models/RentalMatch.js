// ==================== models/RentalMatch.js ====================
const mongoose = require('mongoose');

const rentalMatchSchema = new mongoose.Schema({
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentalRequest',
    required: true,
    index: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  routeConfigId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OwnerRouteConfig',
    required: true
  },
  matchScore: {
    type: Number, // 0.0 to 1.0 (Exact Match = 1.0, Nearby < 1.0)
    default: 1.0
  },
  matchType: {
    type: String,
    enum: ['exact', 'nearby', 'similarity'],
    default: 'exact'
  },
  status: {
    type: String,
    enum: ['new', 'viewed', 'contacted', 'accepted', 'rejected', 'closed'],
    default: 'new',
    index: true
  },
  ownerNotified: {
    type: Boolean,
    default: false
  },
  customerNotified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Ensure we don't create duplicate matches for the same request and owner
rentalMatchSchema.index({ requestId: 1, ownerId: 1 }, { unique: true });

// For dashboard queries
rentalMatchSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('RentalMatch', rentalMatchSchema);
