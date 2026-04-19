// ==================== models/OwnerRouteConfig.js ====================
const mongoose = require('mongoose');

const ownerRouteConfigSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: {
    type: String,
    required: true,
    trim: true
  },
  vehicleType: {
    type: String,
    enum: ['Bus', 'Mini Bus', 'Car', 'Luxury', 'Other'],
    required: true
  },
  priceMin: {
    type: Number,
    required: true,
    min: 0
  },
  priceMax: {
    type: Number,
    required: true,
    min: 0
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Ensure an owner doesn't add duplicate routes for the same vehicle type
ownerRouteConfigSchema.index({ ownerId: 1, from: 1, to: 1, vehicleType: 1 }, { unique: true });
// For matching
ownerRouteConfigSchema.index({ from: 1, to: 1, vehicleType: 1, isActive: 1 });

module.exports = mongoose.model('OwnerRouteConfig', ownerRouteConfigSchema);
