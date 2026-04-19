// ==================== models/VendorProduct.js ====================
const mongoose = require('mongoose');

const vendorProductSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceCategory'
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
  image: String,
  availability: {
    type: Boolean,
    default: true
  },
  prepTime: {
    type: Number,
    default: 5 // minutes
  },
  tags: [String],
  ratings: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  itemsSold: {
    type: Number,
    default: 0
  },
  ingredientInfo: String, // for allergen info
  vegetarian: {
    type: Boolean,
    default: false
  },
  quantity: {
    value: Number,
    unit: String // "ml", "gm", "piece"
  }
}, { timestamps: true });

vendorProductSchema.index({ vendorId: 1, categoryId: 1 });
vendorProductSchema.index({ vendorId: 1, availability: 1 });
vendorProductSchema.index({ categoryId: 1 });
vendorProductSchema.index({ tags: 1 });

module.exports = mongoose.model('VendorProduct', vendorProductSchema);
