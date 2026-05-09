// ==================== controllers/marketplaceController.js ====================
const ServiceProvider = require('../models/ServiceProvider');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');

// Helper: build a location $or query from all provider service areas + fallback location.city
const buildLocationQuery = (provider) => {
  const cities = [];
  if (provider.serviceAreas?.length > 0) {
    provider.serviceAreas.forEach(area => { if (area.city) cities.push(area.city); });
  }
  if (provider.location?.city) cities.push(provider.location.city);
  const unique = [...new Set(cities)];
  if (!unique.length) return null;
  return { $or: unique.map(c => ({ location: new RegExp(c, 'i') })) };
};

// --- PROVIDER REGISTRATION ---
exports.registerProvider = async (req, res) => {
  try {
    const { serviceType, businessName, description, location, pricing, availability, serviceAreas, routes } = req.body;
    
    let provider = await ServiceProvider.findOne({ userId: req.user.id });
    if (provider) {
      return res.status(400).json({ success: false, message: 'User is already registered as a provider' });
    }

    // Build serviceAreas: if passed use them; else derive from location.city with default radius
    const areas = (serviceAreas && serviceAreas.length > 0)
      ? serviceAreas
      : (location?.city ? [{ city: location.city, radiusKm: 50 }] : []);

    provider = new ServiceProvider({
      userId: req.user.id,
      serviceType,
      businessName,
      description,
      location,
      serviceAreas: areas,
      routes: routes || [],
      pricing,
      availability
    });
    
    await provider.save();
    
    // Update user record with role flags AND serviceType for UI labels
    await User.findByIdAndUpdate(req.user.id, { 
      isServiceProvider: true,
      serviceType: serviceType 
    });
    
    res.status(201).json({ success: true, data: provider });
  } catch (error) {
    console.error('Error registering provider:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- UPDATE COVERAGE (existing providers) ---
exports.updateProviderCoverage = async (req, res) => {
  try {
    const { serviceAreas, routes } = req.body;
    if (!serviceAreas || !Array.isArray(serviceAreas)) {
      return res.status(400).json({ success: false, message: 'serviceAreas array is required' });
    }
    for (const area of serviceAreas) {
      if (!area.city) return res.status(400).json({ success: false, message: 'Each area needs a city' });
      if (!area.radiusKm || area.radiusKm < 1 || area.radiusKm > 200) {
        return res.status(400).json({ success: false, message: 'radiusKm must be between 1 and 200' });
      }
    }
    const provider = await ServiceProvider.findOneAndUpdate(
      { userId: req.user.id },
      { serviceAreas, routes: routes || [] },
      { new: true }
    );
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });
    res.json({ success: true, data: provider });
  } catch (error) {
    console.error('Error updating coverage:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- TOGGLE PROVIDER ACTIVE STATUS ---
exports.toggleProviderStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive boolean flag is required' });
    }
    
    const provider = await ServiceProvider.findOneAndUpdate(
      { userId: req.user.id },
      { isActive },
      { new: true }
    );
    
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }
    
    res.json({ success: true, data: provider });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- UPDATE PROVIDER PROFILE ---
exports.updateProviderProfile = async (req, res) => {
  try {
    const { businessName, description, location, pricing, availability } = req.body;
    
    const update = {};
    if (businessName) update.businessName = businessName;
    if (description) update.description = description;
    if (location) update.location = location;
    if (pricing) update.pricing = pricing;
    if (availability) update.availability = availability;

    const provider = await ServiceProvider.findOneAndUpdate(
      { userId: req.user.id },
      update,
      { new: true }
    );
    
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });
    
    res.json({ success: true, data: provider });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }

// --- GET OWN PROVIDER PROFILE ---
exports.getMyProviderProfile = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ userId: req.user.id })
      .populate('userId', 'name phone');
    if (!provider) return res.status(404).json({ success: false, message: 'No provider profile found' });
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- CUSTOMER SEARCH FLOW (MODEL A) ---
exports.searchServices = async (req, res) => {
  try {
    const { serviceType, city, page = 1, limit = 10, sortBy = 'newest' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const query = { isApproved: true, isActive: true };
    if (serviceType) query.serviceType = serviceType;

    if (city) {
      query.$or = [
        { 'serviceAreas.city': { $regex: city, $options: 'i' } },
        { 'location.city': { $regex: city, $options: 'i' } }
      ];
    }

    console.log('🔍 [searchServices] Query:', JSON.stringify(query));

    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 } };
    const sort = sortMap[sortBy] || sortMap.newest;

    const [providers, total] = await Promise.all([
      ServiceProvider.find(query)
        .populate('userId', 'name phone')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      ServiceProvider.countDocuments(query)
    ]);
      
    console.log(`✅ [searchServices] Found ${providers.length} providers`);
    res.status(200).json({
      success: true,
      data: providers,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Error searching services:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- REQUIREMENT POSTING (MODEL B) ---
exports.createServiceRequest = async (req, res) => {
  try {
    const { serviceType, location, date, budget, description } = req.body;
    const request = new ServiceRequest({ userId: req.user.id, serviceType, location, date, budget, description });
    await request.save();
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- PROVIDER LEAD SYSTEM ---
exports.getMatchingLeads = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const provider = await ServiceProvider.findOne({ userId: req.user.id });
    if (!provider) {
      return res.status(403).json({ success: false, message: 'Only registered providers can view leads' });
    }

    const query = { 
      status: { $in: ['open', 'in_chat'] },
      serviceType: provider.serviceType
    };

    // Multi-area location matching
    const locationOr = buildLocationQuery(provider);
    if (locationOr) Object.assign(query, locationOr);
    
    const [leads, total] = await Promise.all([
      ServiceRequest.find(query)
        .populate('userId', 'name')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      ServiceRequest.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: leads,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- ADMIN CONTROLS ---
exports.getAllProviders = async (req, res) => {
  try {
    const providers = await ServiceProvider.find()
      .populate('userId', 'name phone email')
      .sort('-createdAt');
    res.status(200).json({ success: true, data: providers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProviderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;
    const provider = await ServiceProvider.findByIdAndUpdate(id, { isApproved }, { new: true });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });
    res.status(200).json({ success: true, data: provider });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
