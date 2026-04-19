// ==================== controllers/vendorController.js ====================
const User = require('../models/User');
const ServiceListing = require('../models/ServiceListing');
const ServiceBooking = require('../models/ServiceBooking');

// Get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await User.find({ role: 'vendor', isVerified: true });
    res.status(200).json({ success: true, vendors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await User.findById(req.params.id);
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.status(200).json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor profile
exports.getVendorProfile = async (req, res) => {
  try {
    const vendor = await User.findById(req.userId);
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    res.status(200).json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update vendor profile
exports.updateVendorProfile = async (req, res) => {
  try {
    const vendor = await User.findByIdAndUpdate(req.userId, req.body, { new: true });
    res.status(200).json({ success: true, message: 'Profile updated', vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor analytics
exports.getAnalytics = async (req, res) => {
  try {
    const vendorId = req.params.vendorId || req.userId;
    
    const services = await ServiceListing.find({ vendorId });
    const bookings = await ServiceBooking.find({ serviceId: { $in: services.map(s => s._id) } });
    
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const completedOrders = bookings.filter(b => b.status === 'completed').length;
    const pendingOrders = bookings.filter(b => b.status === 'pending').length;
    
    res.status(200).json({ 
      success: true, 
      analytics: {
        totalServices: services.length,
        totalOrders: bookings.length,
        completedOrders,
        pendingOrders,
        totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor orders
exports.getVendorOrders = async (req, res) => {
  try {
    const vendorId = req.params.vendorId || req.userId;
    
    const services = await ServiceListing.find({ vendorId });
    const orders = await ServiceBooking.find({ serviceId: { $in: services.map(s => s._id) } })
      .populate('customerId')
      .populate('serviceId');
    
    res.status(200).json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor items
exports.getVendorItems = async (req, res) => {
  try {
    const vendorId = req.params.vendorId || req.userId;
    
    const items = await ServiceListing.find({ vendorId });
    res.status(200).json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add vendor item
exports.addVendorItem = async (req, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    
    const item = new ServiceListing({
      name,
      description,
      price,
      categoryId: category,
      image,
      vendorId: req.userId
    });
    
    await item.save();
    res.status(201).json({ success: true, message: 'Item added', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
