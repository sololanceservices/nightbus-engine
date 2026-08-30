// ==================== controllers/rentalController.js ====================
const RentalRequest = require('../models/RentalRequest');
const RentalService = require('../models/RentalService');
const OwnerRouteConfig = require('../models/OwnerRouteConfig');
const RentalMatch = require('../models/RentalMatch');
const User = require('../models/User');
const Location = require('../models/Location');
const matchingService = require('../services/rentalMatchingService');
const { getEquivalentVehicleTypes } = require('../utils/vehicleTypeMapper');
const { getMatchingConfig, getCapacityBounds, getPriceBounds, evaluateRentalMatch } = require('../utils/matchingHelpers');
const { sendNotification } = require('../utils/notifications');

// --- OWNER ROUTE CONFIG (CAPABILITY LAYER) ---

exports.addRouteConfig = async (req, res) => {
  try {
    const { from, to, vehicleType, priceMin, priceMax, capacity } = req.body;
    
    const normalizedFrom = from.trim();
    const normalizedTo = to.trim();

    // Upsert behavior: Find or Update
    // We use a case-insensitive check for the locations
    const config = await OwnerRouteConfig.findOneAndUpdate(
      {
        ownerId: req.user.id,
        from: { $regex: new RegExp(`^${normalizedFrom}$`, 'i') },
        to: { $regex: new RegExp(`^${normalizedTo}$`, 'i') },
        vehicleType
      },
      {
        from: normalizedFrom, // Maintain the case the user provided
        to: normalizedTo,
        priceMin,
        priceMax,
        capacity,
        isActive: true
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    // Trigger matching for existing requests (Async)
    matchingService.matchServiceToRequests(config._id).catch(err => console.error('Matching trigger failed:', err));

    res.status(200).json({ success: true, data: config, message: 'Route configuration saved' });
  } catch (error) {
    console.error('Error adding/updating route config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOwnerRouteConfigs = async (req, res) => {
  try {
    const configs = await OwnerRouteConfig.find({ ownerId: req.user.id });
    res.status(200).json({ success: true, data: configs });
  } catch (error) {
    console.error('Error fetching route configs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteRouteConfig = async (req, res) => {
  try {
    const config = await OwnerRouteConfig.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!config) return res.status(404).json({ success: false, message: 'Config not found' });
    
    // Also cleanup linked availability
    await RentalService.deleteMany({ routeConfigId: config._id });
    
    res.status(200).json({ success: true, message: 'Route config and linked availability deleted' });
  } catch (error) {
    console.error('Error deleting route config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateRouteConfig = async (req, res) => {
  try {
    const { from, to, vehicleType, priceMin, priceMax, capacity, isActive } = req.body;
    
    const config = await OwnerRouteConfig.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      { from, to, vehicleType, priceMin, priceMax, capacity, isActive },
      { new: true, runValidators: true }
    );

    if (!config) return res.status(404).json({ success: false, message: 'Config not found' });
    
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('Error updating route config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- OWNER RENTAL SERVICE (AVAILABILITY LAYER) ---

exports.addRentalService = async (req, res) => {
  try {
    const { routeConfigId, busId, availableDates, description, priceMin, priceMax } = req.body;
    
    // Verify routeConfig exists and belongs to owner
    const config = await OwnerRouteConfig.findOne({ _id: routeConfigId, ownerId: req.user.id });
    if (!config) return res.status(404).json({ success: false, message: 'Route configuration not found' });

    // Normalize all available dates to midnight UTC to prevent time-based mismatches
    const normalizedDates = (availableDates || []).map(d => {
      const dateObj = new Date(d);
      dateObj.setUTCHours(0, 0, 0, 0);
      return dateObj;
    });

    const service = new RentalService({
      ownerId: req.user.id,
      routeConfigId,
      busId: busId || null,
      availableDates: normalizedDates,
      description,
      // Allow per-posting price override
      ...(priceMin && { priceMin }),
      ...(priceMax && { priceMax })
    });
    
    await service.save();
    
    // Trigger proactive matching for the new availability (Async)
    matchingService.matchAvailabilityToRequests(service._id).catch(err => console.error('Matching trigger failed:', err));

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    console.error('Error adding availability:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOwnerRentalServices = async (req, res) => {
  try {
    const services = await RentalService.find({ ownerId: req.user.id })
      .populate('routeConfigId')
      .sort('-createdAt');
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteRentalService = async (req, res) => {
  try {
    const service = await RentalService.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    res.status(200).json({ success: true, message: 'Availability deleted' });
  } catch (error) {
    console.error('Error deleting service:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- CUSTOMER APIs ---

exports.createRequest = async (req, res) => {
  try {
    const {
      from, to, date, occasion, vehicleType, budgetMin, budgetMax, peopleCount, note,
      tripType, returnDate, departureTime, luggageRequirement, isAC
    } = req.body;
    
    // Normalize date to midnight UTC to prevent time-based mismatches
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    let normalizedReturnDate = undefined;
    if (returnDate) {
      normalizedReturnDate = new Date(returnDate);
      normalizedReturnDate.setUTCHours(0, 0, 0, 0);
    }

    const request = new RentalRequest({
      userId: req.user.id,
      from,
      to,
      date: normalizedDate,
      occasion,
      vehicleType,
      budgetMin,
      budgetMax,
      peopleCount,
      note,
      tripType: tripType || 'one_way',
      returnDate: normalizedReturnDate,
      departureTime,
      luggageRequirement: luggageRequirement || 'none',
      isAC: isAC !== undefined ? isAC : false,
      status: 'open'
    });

    await request.save();

    // Trigger proactive matching engine (Async)
    matchingService.matchRequestToOwners(request._id).catch(err => console.error('Matching trigger failed:', err));

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Error creating rental request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCustomerRequests = async (req, res) => {
  try {
    const requests = await RentalRequest.find({ userId: req.user.id }).sort('-createdAt');
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('Error fetching customer rental requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.closeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await RentalRequest.findOneAndUpdate(
      { _id: requestId, userId: req.user.id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error('Error closing request:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- MATCHING APIs (UPGRADED) ---

exports.getMatchingRequestsForOwner = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 1. Get owner's route capabilities
    const configs = await OwnerRouteConfig.find({ ownerId: req.user.id, isActive: true });
    if (configs.length === 0) return res.status(200).json({ success: true, data: [], pagination: { page, limit, total: 0 } });

    // 2. Get active availability dates
    const services = await RentalService.find({ ownerId: req.user.id });
    const allAvailableDates = [].concat(...services.map(s => s.availableDates));

    const dateConditions = allAvailableDates.map(d => {
      const start = new Date(d);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      return { date: { $gte: start, $lte: end } };
    });

    // 3. Build compound match query using flexible capacity and price bounds
    const { minFillRatio, minCapacityRatio, priceTolerancePct } = getMatchingConfig();
    const orConditions = configs.map(cfg => {
      const minReqPeople = Math.max(1, Math.ceil(cfg.capacity * minFillRatio));
      const maxReqPeople = Math.floor(cfg.capacity / minCapacityRatio);
      const budgetMinTol = Math.max(0, Math.round(cfg.priceMin * (1 - priceTolerancePct)));
      const budgetMaxTol = Math.round(cfg.priceMax * (1 + priceTolerancePct));

      return {
        from: new RegExp(cfg.from, 'i'),
        to: new RegExp(cfg.to, 'i'),
        vehicleType: { $in: getEquivalentVehicleTypes(cfg.vehicleType) },
        peopleCount: { $gte: minReqPeople, $lte: maxReqPeople },
        budgetMax: { $gte: budgetMinTol },
        budgetMin: { $lte: budgetMaxTol }
      };
    });

    const query = {
      status: 'open',
      $or: orConditions
    };

    if (dateConditions.length > 0) {
      query.$and = [{ $or: dateConditions }];
    } else {
      query._id = null; // Do not match any requests if there are no available dates
    }

    const [requests, total] = await Promise.all([
      RentalRequest.find(query)
        .populate('userId', 'name phone')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      RentalRequest.countDocuments(query)
    ]);

    res.status(200).json({ 
      success: true, 
      data: requests,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching matching requests:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMatchingOwnersForCustomer = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { sortBy = 'price' } = req.query; // 'price' or 'rating'

    const request = await RentalRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // 1. Find services available on that date (ignoring time components)
    const startOfDay = new Date(request.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(request.date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Resolve city names from the full addresses
    let fromCity = request.from;
    let toCity = request.to;
    
    const allLocations = await Location.find({ isActive: true });
    
    let bestFromMatch = null;
    for (const loc of allLocations) {
      let matches = false;
      const escapedName = loc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapedName}\\b`, 'i').test(request.from)) {
        matches = true;
      } else if (loc.aliases && loc.aliases.length > 0) {
        for (const alias of loc.aliases) {
          if (!alias) continue;
          const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`\\b${escapedAlias}\\b`, 'i').test(request.from)) {
            matches = true;
            break;
          }
        }
      }
      
      if (matches) {
        if (!bestFromMatch || loc.name.length > bestFromMatch.name.length) {
          bestFromMatch = loc;
        }
      }
    }
    if (bestFromMatch) fromCity = bestFromMatch.name;

    let bestToMatch = null;
    for (const loc of allLocations) {
      let matches = false;
      const escapedName = loc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapedName}\\b`, 'i').test(request.to)) {
        matches = true;
      } else if (loc.aliases && loc.aliases.length > 0) {
        for (const alias of loc.aliases) {
          if (!alias) continue;
          const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`\\b${escapedAlias}\\b`, 'i').test(request.to)) {
            matches = true;
            break;
          }
        }
      }

      if (matches) {
        if (!bestToMatch || loc.name.length > bestToMatch.name.length) {
          bestToMatch = loc;
        }
      }
    }
    if (bestToMatch) toCity = bestToMatch.name;

    // Calculate capacity bounds and price bounds with tolerance for initial loose filter (optional, but let's just get all available for accurate debugging)
    const availability = await RentalService.find({
      availableDates: { $elemMatch: { $gte: startOfDay, $lte: endOfDay } }
    }).populate('routeConfigId').populate('ownerId', 'name profilePicture companyName isVerified');

    let filtered = [];
    let evaluations = [];

    // Evaluate each available service in memory for precise debugging
    for (const a of availability) {
      if (a.routeConfigId) {
        // Run full evaluation
        const evalResult = evaluateRentalMatch(a.routeConfigId, request, fromCity, toCity, a.availableDates);
        
        evaluations.push({
          ownerId: a.ownerId ? (a.ownerId._id || a.ownerId) : null,
          isMatch: evalResult.isMatch,
          reasons: evalResult.reasons
        });

        if (evalResult.isMatch) {
          filtered.push(a);
        } else {
          console.log(`[Rental Match Reject] Req ${requestId} vs Owner ${a.ownerId?.name}: ${evalResult.reasons.join(' | ')}`);
        }
      }
    }

    // 2. Score and Sort
    // Closeness score = 1 / (1 + price difference)
    const processed = filtered.map(a => {
      const avgPrice = (a.routeConfigId.priceMin + a.routeConfigId.priceMax) / 2;
      const targetPrice = (request.budgetMin + request.budgetMax) / 2;
      const priceCloseness = Math.abs(avgPrice - targetPrice);
      
      return {
        ...a.ownerId.toObject(),
        matchedService: a,
        priceCloseness
      };
    });

    if (sortBy === 'price') {
      processed.sort((a, b) => a.priceCloseness - b.priceCloseness);
    }

    res.status(200).json({ success: true, data: processed, evaluations });
  } catch (error) {
    console.error('Error fetching matching owners:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
// --- LEADS MANAGEMENT (TOP CLASS FEATURE) ---

/**
 * Get matches/leads for the owner to act on
 */
exports.getOwnerLeads = async (req, res) => {
  try {
    const { status = 'new' } = req.query;
    
    const query = { ownerId: req.user.id };
    
    if (status === 'all') {
      query.status = { $exists: true };
    } else {
      query.status = status;
      // If fetching 'new' leads, only show ones created in the last 48 hours
      if (status === 'new') {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        query.createdAt = { $gte: twoDaysAgo };
      }
    }

    const leads = await RentalMatch.find(query)
    .populate({
      path: 'requestId',
      populate: { path: 'userId', select: 'name phone' }
    })
    .populate('routeConfigId')
    .sort('-createdAt');

    res.status(200).json({ success: true, data: leads });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Mark lead as viewed or connected
 */
exports.updateLeadStatus = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status } = req.body;

    const lead = await RentalMatch.findOneAndUpdate(
      { _id: leadId, ownerId: req.user.id },
      { status },
      { new: true }
    );

    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
