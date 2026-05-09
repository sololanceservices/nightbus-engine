const mongoose = require('mongoose');

const featuredDestinationSchema = new mongoose.Schema({
  image: { type: String, required: true },
  fromCity: { type: String, required: true },
  toCity: { type: String, required: true },
  avgPrice: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('FeaturedDestination', featuredDestinationSchema);
