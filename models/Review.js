// ==================== models/Review.js ====================
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true,
    index: true
  },
  contextType: {
    type: String,
    enum: ['service', 'rental'],
    required: true
  },
  contextId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  }
}, { timestamps: true });

// One review per user per context
reviewSchema.index({ userId: 1, contextType: 1, contextId: 1 }, { unique: true });
// For fast average calculation per provider
reviewSchema.index({ providerId: 1, rating: 1 });

module.exports = mongoose.model('Review', reviewSchema);
