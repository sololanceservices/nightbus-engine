const HomeBanner = require('../models/HomeBanner');
const FeaturedDestination = require('../models/FeaturedDestination');
const YatraPackage = require('../models/YatraPackage');
const AdBanner = require('../models/AdBanner');
const fs = require('fs');
const path = require('path');

// --- PUBLIC ENDPOINTS ---

exports.getHomeContent = async (req, res) => {
  try {
    const banners = await HomeBanner.find({ isActive: true }).sort({ order: 1 });
    const featured = await FeaturedDestination.find({ isActive: true }).sort({ order: 1 });
    const adBanners = await AdBanner.find({ isActive: true }).sort({ order: 1 });
    
    // Fetch all upcoming active Yatra packages for the home calendar
    const latestYatras = await YatraPackage.find({ 
      status: 'active',
      startDate: { $gte: new Date() }
    })
      .sort({ startDate: 1 })
      .select('title description startDate endDate images category pricePerPerson totalSeats bookedSeats destinationCity departurePoint');

    res.json({
      success: true,
      data: {
        banners,
        featured,
        latestYatras,
        adBanners
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
      const adBanners = await AdBanner.find().sort({ order: 1 });
      res.json({ success: true, data: { banners, featured, adBanners } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
};

exports.uploadHomeImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const targetDir = path.join(__dirname, '../uploads/home');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const backupDir = path.join(__dirname, '../../../backups/home_images');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const extension = path.extname(req.file.originalname);
    const fileName = `home-${Date.now()}${extension}`;
    const targetPath = path.join(targetDir, fileName);
    const backupPath = path.join(backupDir, fileName);

    // Move from temp to target
    fs.renameSync(req.file.path, targetPath);
    // Copy to backup
    fs.copyFileSync(targetPath, backupPath);

    const publicUrl = `/uploads/home/${fileName}`;
    res.json({ success: true, data: publicUrl });
  } catch (error) {
    console.error('Home image upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await HomeBanner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: banner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateFeaturedDestination = async (req, res) => {
  try {
    const destination = await FeaturedDestination.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!destination) return res.status(404).json({ success: false, message: 'Destination not found' });
    res.json({ success: true, data: destination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAdBanner = async (req, res) => {
  try {
    const adBanner = new AdBanner(req.body);
    await adBanner.save();
    res.status(201).json({ success: true, data: adBanner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAdBanner = async (req, res) => {
  try {
    const adBanner = await AdBanner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!adBanner) return res.status(404).json({ success: false, message: 'Ad banner not found' });
    res.json({ success: true, data: adBanner });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAdBanner = async (req, res) => {
  try {
    const adBanner = await AdBanner.findByIdAndDelete(req.params.id);
    if (!adBanner) return res.status(404).json({ success: false, message: 'Ad banner not found' });
    res.json({ success: true, message: 'Ad banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
