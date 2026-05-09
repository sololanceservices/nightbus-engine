// ==================== models/ServiceProvider.js ====================
const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    unique: true // One provider profile per user
  },
  serviceType: {
    type: String,
    // Add known types but keep it open enough for expansion
    enum: ['Driver', 'Taxi', 'Hotel', 'Photographer', 'Event Organizer', 'Hall/Garden', 'Dhool', 'Buggy', 'Other'],
    required: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
    city: { type: String, required: true },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  // Multi-area coverage (new - primary matching source)
  serviceAreas: [{
    city: { type: String, required: true, trim: true },
    radiusKm: { type: Number, required: true, min: 1, max: 200 }
  }],
  // Optional transport routes (for Driver/Taxi)
  routes: [{
    from: { type: String, trim: true },
    to:   { type: String, trim: true }
  }],
  pricing: {
    type: String,
    default: 'Contact for pricing'
  },
  availability: {
    type: String,
    default: 'Available 24/7'
  },
  isApproved: {
    type: Boolean,
    default: true // for simplicity MVP
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

serviceProviderSchema.index({ serviceType: 1, 'location.city': 1 });
serviceProviderSchema.index({ serviceType: 1, 'serviceAreas.city': 1 });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
