// ==================== controllers/adminController.js ====================
const User = require('../models/User');
const Journey = require('../models/Journey');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Segment = require('../models/Segment');
const ServiceProvider = require('../models/ServiceProvider');
const ServiceCategory = require('../models/ServiceCategory');
const Settlement = require('../models/Settlement');
const GlobalAnnouncement = require('../models/GlobalAnnouncement');
const VendorProduct = require('../models/VendorProduct');
const FoodOrder = require('../models/FoodOrder');
const { sendBroadcastNotification } = require('../utils/notifications');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user details
exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, message: 'User updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all bookings
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Journey.find().populate('customerId').populate('segments');
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
  try {
    const booking = await Journey.findById(req.params.id).populate('customerId').populate('segments');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all buses
exports.getAllBuses = async (req, res) => {
  try {
    const buses = await Bus.find().populate('ownerId');
    res.status(200).json({ success: true, buses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all routes
exports.getAllRoutes = async (req, res) => {
  try {
    const routes = await Route.find().populate('ownerId');
    res.status(200).json({ success: true, routes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get analytics
exports.getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBookings = await Journey.countDocuments();
    const totalBuses = await Bus.countDocuments();
    const totalRoutes = await Route.countDocuments();
    
    const totalRevenue = (await Journey.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]))[0]?.total || 0;
    
    res.status(200).json({ 
      success: true, 
      analytics: {
        totalUsers,
        totalBookings,
        totalBuses,
        totalRoutes,
        totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get transactions
exports.getTransactions = async (req, res) => {
  try {
    // TODO: Implement transaction history
    res.status(200).json({ success: true, transactions: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify vendor
exports.verifyVendor = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.vendorId,
      { isVerified: true },
      { new: true }
    );
    res.status(200).json({ success: true, message: 'Vendor verified', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify owner
exports.verifyOwner = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.ownerId,
      { isVerified: true },
      { new: true }
    );
    res.status(200).json({ success: true, message: 'Owner verified', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// Block/Unblock user
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (isActive === undefined) return res.status(400).json({ success: false, message: 'isActive status required' });

    const user = await User.findByIdAndUpdate(id, { isActive }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.status(200).json({ success: true, message: `User ${isActive ? 'unblocked' : 'blocked'}`, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve/Reject provider
exports.updateProviderApproval = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { isApproved } = req.body;
    
    const provider = await ServiceProvider.findByIdAndUpdate(providerId, { isApproved }, { new: true });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
    
    res.status(200).json({ success: true, message: `Provider ${isApproved ? 'approved' : 'rejected'}`, provider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Category management
exports.addCategory = async (req, res) => {
  try {
    const category = new ServiceCategory(req.body);
    await category.save();
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await ServiceCategory.find();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await ServiceCategory.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ==================== GLOBAL ANNOUNCEMENTS ====================
 */

exports.sendGlobalBroadcast = async (req, res) => {
  try {
    const { title, body, targetRoles } = req.body;
    const adminId = req.userId || req.user?._id;

    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Admin identification required' });
    }

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const announcement = await sendBroadcastNotification({
      title,
      body,
      targetRoles: targetRoles || ['all'],
      adminId
    });

    res.status(201).json({ 
      success: true, 
      message: 'Global broadcast sent successfully',
      announcement 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGlobalAnnouncements = async (req, res) => {
  try {
    const announcements = await GlobalAnnouncement.find().sort({ createdAt: -1 }).limit(50);
    res.status(200).json({ success: true, announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ==================== FINANCE & SETTLEMENTS ====================
 */

exports.getAllSettlements = async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    
    const settlements = await Settlement.find(query)
      .populate('ownerId', 'name phone')
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, settlements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettlementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, notes } = req.body;
    
    const settlement = await Settlement.findByIdAndUpdate(
      id, 
      { 
        status, 
        transactionId, 
        notes,
        processedBy: req.userId,
        paidAt: status === 'paid' ? new Date() : undefined
      }, 
      { new: true }
    );
    
    if (!settlement) return res.status(404).json({ success: false, message: 'Settlement not found' });
    
    res.status(200).json({ success: true, message: 'Settlement updated', settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ==================== MARKETPLACE & FOOD ====================
 */

exports.getAllProducts = async (req, res) => {
  try {
    const products = await VendorProduct.find().populate('vendorId', 'name phone');
    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.toggleProductStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isAvailable } = req.body;
    
    const product = await VendorProduct.findByIdAndUpdate(productId, { isAvailable }, { new: true });
    res.status(200).json({ success: true, message: 'Product status updated', product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGlobalFoodStats = async (req, res) => {
  try {
    const totalOrders = await FoodOrder.countDocuments();
    const pendingOrders = await FoodOrder.countDocuments({ status: 'pending' });
    const totalRevenue = await FoodOrder.aggregate([
      { $match: { status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        pendingOrders,
        deliveredRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
