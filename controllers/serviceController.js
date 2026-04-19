// ==================== controllers/serviceController.js ====================
const ServiceListing = require('../models/ServiceListing');
const ServiceCategory = require('../models/ServiceCategory');

// Get all services
exports.getAllServices = async (req, res) => {
  try {
    const services = await ServiceListing.find().populate('vendorId').populate('categoryId');
    res.status(200).json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get services by category
exports.getServicesByCategory = async (req, res) => {
  try {
    const services = await ServiceListing.find({ categoryId: req.params.categoryId })
      .populate('vendorId')
      .populate('categoryId');
    res.status(200).json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get service by ID
exports.getServiceById = async (req, res) => {
  try {
    const service = await ServiceListing.findById(req.params.id)
      .populate('vendorId')
      .populate('categoryId');
    
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    
    res.status(200).json({ success: true, service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create service
exports.createService = async (req, res) => {
  try {
    const { name, description, price, categoryId, image } = req.body;
    
    const service = new ServiceListing({
      name,
      description,
      price,
      categoryId,
      image,
      vendorId: req.userId
    });
    
    await service.save();
    res.status(201).json({ success: true, message: 'Service created', service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update service
exports.updateService = async (req, res) => {
  try {
    const service = await ServiceListing.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.status(200).json({ success: true, message: 'Service updated', service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete service
exports.deleteService = async (req, res) => {
  try {
    const service = await ServiceListing.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.status(200).json({ success: true, message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
