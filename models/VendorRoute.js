const mongoose = require('mongoose');

const vendorRouteSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  stopSequence: { type: [Number], required: true },
  operatingDays: { type: [String], enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], required: true },
  operatingHours: {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  isActive: { type: Boolean, default: true },
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ✅ Correct GeoJSON field
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true }
  },
  locationName: { type: String }, // Optional human-readable name

  ratings: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 }

}, { timestamps: true });

// ✅ Indexes
vendorRouteSchema.index({ vendorId: 1, routeId: 1 });
vendorRouteSchema.index({ routeId: 1, isActive: 1 });
vendorRouteSchema.index({ vendorId: 1, isActive: 1 });
vendorRouteSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('VendorRoute', vendorRouteSchema);
