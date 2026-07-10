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
    type: Number, // in minutes (estimated travel time)
    required: true,
    default: 20
  },
  defaultPrepTime: {
    type: Number, // in minutes (kitchen prep time)
    required: true,
    default: 15
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
  fssaiNumber: {
    type: String,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isNightServiceActive: {
    type: Boolean,
    default: false
  },
  bankName: { type: String, trim: true },
  bankAccountNumber: { type: String, trim: true },
  bankIfscCode: { type: String, trim: true },
  bankAccountHolderName: { type: String, trim: true },
  upiId: { type: String, trim: true },
  performance: {
    rating: { type: Number, default: 4.5 },
    totalReviews: { type: Number, default: 0 },
    ordersCompleted: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    complaints: { type: Number, default: 0 }
  }

}, { timestamps: true });

// Geospatial index for distance searches
foodVendorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FoodVendor', foodVendorSchema);
