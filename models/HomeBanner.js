const mongoose = require('mongoose');

const homeBannerSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: String,
  subTitle: String,
  targetPage: { type: String, default: 'YatraList' }, // Page to navigate to
  targetId: String, // ID of specific package if needed
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('HomeBanner', homeBannerSchema);
