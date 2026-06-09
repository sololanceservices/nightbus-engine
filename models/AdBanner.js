const mongoose = require('mongoose');

const adBannerSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  subTitle: String,
  link: { type: String, default: 'https://idarbar.com' },
  ctaText: { type: String, default: 'Explore' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('AdBanner', adBannerSchema);
