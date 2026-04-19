// ==================== models/ServiceListing.js ====================
const mongoose = require('mongoose');

const serviceListingSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  photos: [String],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number],
    address: String
  },
  priceModel: {
    type: String,
    enum: ['fixed', 'hourly', 'daily'],
    default: 'fixed'
  },
  basePrice: {
    type: Number,
    required: true
  },
  availability: [{
    date: Date,
    slots: [{
      startTime: String,
      endTime: String,
      isBooked: Boolean
    }]
  }],
  cancellationPolicy: {
    hours: Number,
    refundPercentage: Number
  },
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

serviceListingSchema.index({ categoryId: 1, isActive: 1 });
serviceListingSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ServiceListing', serviceListingSchema);
