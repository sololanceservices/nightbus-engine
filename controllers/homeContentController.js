const HomeBanner = require('../models/HomeBanner');
const FeaturedDestination = require('../models/FeaturedDestination');
const YatraPackage = require('../models/YatraPackage');

// --- PUBLIC ENDPOINTS ---

exports.getHomeContent = async (req, res) => {
  try {
    const banners = await HomeBanner.find({ isActive: true }).sort({ order: 1 });
    const featured = await FeaturedDestination.find({ isActive: true }).sort({ order: 1 });
    
    res.json({
      success: true,
      data: {
        banners,
        featured
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- ADMIN ENDPOINTS ---

exports.createBanner = async (req, res) => {
  try {
    const banner = new HomeBanner(req.body);
    await banner.save();
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    await HomeBanner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFeaturedDestination = async (req, res) => {
  try {
    const { fromCity, toCity } = req.body;
    
    // Optional: Check if any yatra exists for this route to help admin
    const yatraExists = await YatraPackage.exists({ 
      'departurePoint.city': new RegExp(`^${fromCity}$`, 'i'),
      destinationCity: new RegExp(`^${toCity}$`, 'i'),
      status: 'active'
    });

    const destination = new FeaturedDestination(req.body);
    await destination.save();
    
    res.status(201).json({ 
      success: true, 
      data: destination,
      warning: !yatraExists ? 'Note: No active yatra packages found for this route yet.' : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteFeaturedDestination = async (req, res) => {
  try {
    await FeaturedDestination.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Destination card deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminHomeContent = async (req, res) => {
    try {
      const banners = await HomeBanner.find().sort({ order: 1 });
      const featured = await FeaturedDestination.find().sort({ order: 1 });
      res.json({ success: true, data: { banners, featured } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
};
