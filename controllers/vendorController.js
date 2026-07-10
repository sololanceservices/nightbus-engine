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
    
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || b.totalPrice || 0), 0);
    const completedOrders = bookings.filter(b => b.status === 'completed').length;
    const pendingOrders = bookings.filter(b => b.status === 'requested' || b.status === 'pending').length;
    const preparingOrders = bookings.filter(b => b.status === 'accepted' || b.status === 'confirmed').length;
    const readyOrders = bookings.filter(b => b.status === 'in-progress').length;
    const deliveredOrders = completedOrders;
    
    const averageRating = 5.0; // default/mock for new dashboard analytics
    const completionRate = bookings.length > 0 ? Math.round((completedOrders / bookings.length) * 100) : 100;
    const avgDeliveryTime = 15;
    const customerSatisfaction = 98;
    
    const topItems = services.slice(0, 3).map(s => ({
      name: s.name,
      sales: bookings.filter(b => b.serviceId.toString() === s._id.toString()).length,
      revenue: bookings.filter(b => b.serviceId.toString() === s._id.toString()).reduce((sum, b) => sum + (b.totalAmount || b.totalPrice || 0), 0)
    }));
    
    res.status(200).json({ 
      success: true, 
      analytics: {
        totalServices: services.length,
        totalOrders: bookings.length,
        completedOrders,
        pendingOrders,
        preparingOrders,
        readyOrders,
        deliveredOrders,
        totalRevenue,
        averageRating,
        completionRate,
        avgDeliveryTime,
        customerSatisfaction,
        topItems
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get vendor orders
exports.getVendorOrders = async (req, res) => {
  try {
    const id = req.params.vendorId || req.params.id || req.userId;
    
    // Check if the id matches a ServiceBooking (single order detail request)
    let singleBooking = null;
    try {
      singleBooking = await ServiceBooking.findById(id)
        .populate('customerId')
        .populate('serviceId')
        .populate('journeyId');
    } catch (e) {
      // Not a valid ObjectId or other DB error, proceed to treat as vendor ID
    }
    
    if (singleBooking) {
      const formattedOrder = {
        _id: singleBooking._id.toString(),
        status: singleBooking.status === 'requested' ? 'pending' : (singleBooking.status === 'accepted' ? 'preparing' : (singleBooking.status === 'in-progress' ? 'ready' : (singleBooking.status === 'completed' ? 'delivered' : singleBooking.status))),
        customerName: singleBooking.customerId?.name || 'Customer',
        customerPhone: singleBooking.customerId?.phone || '',
        deliveryStop: singleBooking.timeSlot ? `${singleBooking.timeSlot.startTime || ''} - ${singleBooking.timeSlot.endTime || ''}` : 'Location',
        expectedDeliveryTime: singleBooking.bookingDate ? new Date(singleBooking.bookingDate).toLocaleDateString() : 'N/A',
        items: [{
          name: singleBooking.serviceId?.name || 'Service',
          quantity: singleBooking.quantity || 1,
          price: singleBooking.serviceId?.price || singleBooking.totalAmount
        }],
        subtotal: singleBooking.totalAmount,
        deliveryFee: 0,
        totalAmount: singleBooking.totalAmount,
        createdAt: singleBooking.createdAt
      };
      return res.status(200).json({ success: true, order: formattedOrder });
    }
    
    // Otherwise, treat the id as a vendor ID and find all service bookings
    const services = await ServiceListing.find({ vendorId: id });
    const orders = await ServiceBooking.find({ serviceId: { $in: services.map(s => s._id) } })
      .populate('customerId')
      .populate('serviceId');
    
    const formattedOrders = orders.map(order => {
      return {
        _id: order._id.toString(),
        status: order.status === 'requested' ? 'pending' : (order.status === 'accepted' ? 'preparing' : (order.status === 'in-progress' ? 'ready' : (order.status === 'completed' ? 'delivered' : order.status))),
        customerName: order.customerId?.name || 'Customer',
        customerPhone: order.customerId?.phone || '',
        deliveryStop: order.timeSlot ? `${order.timeSlot.startTime || ''} - ${order.timeSlot.endTime || ''}` : 'Location',
        expectedDeliveryTime: order.bookingDate ? new Date(order.bookingDate).toLocaleDateString() : 'N/A',
        items: [{
          name: order.serviceId?.name || 'Service',
          quantity: order.quantity || 1,
          price: order.serviceId?.price || order.totalAmount
        }],
        subtotal: order.totalAmount,
        deliveryFee: 0,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
      };
    });
    
    res.status(200).json({ success: true, orders: formattedOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update vendor order status
exports.updateVendorOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Map client status to backend ServiceBooking status
    let backendStatus;
    if (status === 'preparing') {
      backendStatus = 'accepted';
    } else if (status === 'ready') {
      backendStatus = 'in-progress';
    } else if (status === 'delivered') {
      backendStatus = 'completed';
    } else if (status === 'cancelled') {
      backendStatus = 'cancelled';
    } else {
      backendStatus = status; // fallback
    }
    
    const booking = await ServiceBooking.findByIdAndUpdate(
      id,
      { status: backendStatus },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Service booking not found' });
    }
    
    res.status(200).json({ success: true, message: 'Order status updated', booking });
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
