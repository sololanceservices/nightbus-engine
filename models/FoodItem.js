// ==================== models/FoodItem.js ====================
const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodVendor',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  price: {
    type: Number,
    required: true
  },
  prepTime: {
    type: Number, // in minutes
    required: true,
    default: 15
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  images: [{ type: String }],
  isVeg: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    enum: ['thali', 'fastfood', 'beverages', 'chinese', 'all'],
    default: 'all'
  }
}, { timestamps: true });

module.exports = mongoose.model('FoodItem', foodItemSchema);
