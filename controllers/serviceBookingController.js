// ==================== controllers/serviceBookingController.js ====================
const ServiceBooking = require('../models/ServiceBooking');
const ServiceListing = require('../models/ServiceListing');

// Create service booking
exports.createServiceBooking = async (req, res) => {
  try {
    const { serviceId, journeyId, quantity, specialRequests } = req.body;
    
    const service = await ServiceListing.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    
    const serviceBooking = new ServiceBooking({
      customerId: req.userId,
      serviceId,
      journeyId,
      quantity,
      totalPrice: service.price * quantity,
      specialRequests,
      status: 'pending'
    });
    
    await serviceBooking.save();
    res.status(201).json({ success: true, message: 'Service booking created', serviceBooking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get service booking by ID
exports.getServiceBookingById = async (req, res) => {
  try {
    const booking = await ServiceBooking.findById(req.params.id)
      .populate('customerId')
      .populate('serviceId')
      .populate('journeyId');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Service booking not found' });
    }
    
    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get customer service bookings
exports.getCustomerServiceBookings = async (req, res) => {
  try {
    const bookings = await ServiceBooking.find({ customerId: req.params.customerId })
      .populate('serviceId')
      .populate('journeyId');
    
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel service booking
exports.cancelServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Service booking not found' });
    }
    
    res.status(200).json({ success: true, message: 'Service booking cancelled', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Complete service booking
exports.completeServiceBooking = async (req, res) => {
  try {
    const booking = await ServiceBooking.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', completedAt: new Date() },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Service booking not found' });
    }
    
    res.status(200).json({ success: true, message: 'Service booking completed', booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
