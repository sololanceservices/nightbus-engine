// ==================== models/FoodVendor.js ====================
const mongoose = require('mongoose');

const foodVendorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  deliveryRadius: {
    type: Number, // in kilometers
    required: true,
    default: 5
  },
  avgDeliveryTime: {
    type: Number, // in minutes
    required: true,
    default: 20
  },
  serviceAreas: [
    {
      city: { type: String, required: true },
      radiusKm: { type: Number, required: true }
    }
  ],
  routes: [
    {
      from: { type: String, required: true },
      to: { type: String, required: true }
    }
  ],
  availableHours: {
    startTime: { type: String, required: true, default: "08:00" },
    endTime: { type: String, required: true, default: "22:00" }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Geospatial index for distance searches
foodVendorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FoodVendor', foodVendorSchema);
