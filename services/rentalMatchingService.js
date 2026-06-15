const RentalRequest = require('../models/RentalRequest');
const OwnerRouteConfig = require('../models/OwnerRouteConfig');
const RentalMatch = require('../models/RentalMatch');
const RentalService = require('../models/RentalService');
const Location = require('../models/Location');
const { sendNotification } = require('../utils/notifications');
const { getEquivalentVehicleTypes } = require('../utils/vehicleTypeMapper');

/**
 * Calculate distance between two points in km (Haversine formula)
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Helper to resolve a Location object from a full address string
 */
const resolveLocationFromAddress = async (address, allLocations) => {
  if (!address) return null;
  const escapedAddress = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // First attempt: exact match
  let matchedLoc = await Location.findOne({ name: new RegExp(`^${escapedAddress}$`, 'i') });
  if (matchedLoc) return matchedLoc;

  // Second attempt: substring match against active locations
  let bestMatch = null;
  for (const loc of allLocations) {
    const escapedName = loc.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escapedName}\\b`, 'i').test(address)) {
      if (!bestMatch || loc.name.length > bestMatch.name.length) {
        bestMatch = loc;
      }
    }
  }
  return bestMatch;
};

/**
 * Core matching engine to find matches for a rental request
 * Designed to be run proactively when a request is created.
 */
exports.matchRequestToOwners = async (requestId) => {
  try {
    const request = await RentalRequest.findById(requestId).populate('userId', 'name');
    if (!request) return;

    console.log(`🔍 Running matching engine for request ${requestId} (${request.from} -> ${request.to})`);

    // 1. Get coordinates for request source/dest
    const allLocations = await Location.find({ isActive: true });
    const fromLoc = await resolveLocationFromAddress(request.from, allLocations);
    const toLoc = await resolveLocationFromAddress(request.to, allLocations);

    // 2. Query configurations (exact name match first, then proximity)
    const configs = await OwnerRouteConfig.find({
      isActive: true,
      vehicleType: { $in: getEquivalentVehicleTypes(request.vehicleType) },
      capacity: { $gte: request.peopleCount }
    }).populate('ownerId', 'name fcmToken fcmTokens');

    // 2b. Get owners who are AVAILABLE on this specific date (ignoring time component)
    const startOfDay = new Date(request.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(request.date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const availableOwners = await RentalService.find({
      availableDates: { $elemMatch: { $gte: startOfDay, $lte: endOfDay } }
    }).distinct('ownerId');

    const availableOwnerIds = availableOwners.map(id => id.toString());

    const matches = [];

    for (const cfg of configs) {
      if (!cfg.ownerId) continue;
      // ONLY match if the owner is available on this date
      const ownerId = (cfg.ownerId._id || cfg.ownerId).toString();
      if (!availableOwnerIds.includes(ownerId)) continue;

      let score = 0;
      let matchType = 'similarity';

      // City Name Similarity (Case-insensitive)
      const fromMatch = cfg.from.toLowerCase() === request.from.toLowerCase() ||
                        (fromLoc && cfg.from.toLowerCase() === fromLoc.name.toLowerCase());
      const pathMatch = cfg.to.toLowerCase() === request.to.toLowerCase() ||
                        (toLoc && cfg.to.toLowerCase() === toLoc.name.toLowerCase());

      if (fromMatch && pathMatch) {
        score = 1.0;
        matchType = 'exact';
      } else if (fromMatch || pathMatch) {
        // One leg matches exactly, check the other leg's proximity
        score = 0.8; 
        matchType = 'partial';
      }

      // Proximity Match (Geometric) - Only if coordinates are available
      if (score < 1.0 && fromLoc && toLoc) {
        // Check if owner's config cities are nearby
        const [ownerFrom, ownerTo] = await Promise.all([
          Location.findOne({ name: new RegExp(`^${cfg.from}$`, 'i') }),
          Location.findOne({ name: new RegExp(`^${cfg.to}$`, 'i') })
        ]);

        if (ownerFrom?.coordinates?.latitude && ownerTo?.coordinates?.latitude) {
          const distFrom = getDistance(
            fromLoc.coordinates.latitude, 
            fromLoc.coordinates.longitude, 
            ownerFrom.coordinates.latitude, 
            ownerFrom.coordinates.longitude
          );
          const distTo = getDistance(
            toLoc.coordinates.latitude, 
            toLoc.coordinates.longitude, 
            ownerTo.coordinates.latitude, 
            ownerTo.coordinates.longitude
          );

          // Threshold: 60km for "nearby" matching (Premium algorithm)
          if (distFrom < 60 && distTo < 60) {
            const proxScore = Math.max(0.7, 1.0 - (distFrom + distTo) / 240);
            if (proxScore > score) {
              score = proxScore;
              matchType = 'nearby';
            }
          }
        }
      }

      // If we have a match, create a lead
      if (score > 0.6 && cfg.ownerId && request.userId) {
        matches.push({
          requestId: request._id,
          ownerId: cfg.ownerId._id || cfg.ownerId,
          customerId: request.userId._id || request.userId,
          routeConfigId: cfg._id,
          matchScore: score,
          matchType
        });
      }
    }

    if (matches.length > 0) {
      console.log(`✨ Found ${matches.length} matches for request ${requestId}`);
    } else {
      console.log(`ℹ️ No matches found for request ${requestId}`);
    }

    // 3. Save matches and avoid duplicates
    for (const matchData of matches) {
      try {
        const lead = await RentalMatch.findOneAndUpdate(
          { requestId: matchData.requestId, ownerId: matchData.ownerId },
          { ...matchData, $setOnInsert: { status: 'new' } },
          { upsert: true, new: true }
        );

        // 4. Notify Owner (Safe check for FCM tokens)
        const ownerFound = configs.find(c => c.ownerId && (c.ownerId._id || c.ownerId).toString() === matchData.ownerId.toString());
        const owner = ownerFound ? ownerFound.ownerId : null;

        if (owner && !lead.ownerNotified) {
          await sendNotification(owner._id || owner, {
            title: '🎉 New Rental Lead!',
            body: `You have a ${Math.round(matchData.matchScore * 100)}% match for a ${request.vehicleType} from ${request.from}.`,
            type: 'new_rental_lead',
            data: { leadId: lead._id.toString(), requestId: requestId.toString() }
          });
          lead.ownerNotified = true;
          await lead.save();
        }
      } catch (e) {
        if (e.code !== 11000) console.error('Match saving error:', e);
      }
    }

    // 5. Notify Customer (Summary)
    if (matches.length > 0) {
      await sendNotification(request.userId._id || request.userId, {
        title: '✅ Search Result',
        body: `We found ${matches.length} bus owners matched for your trip from ${request.from}!`,
        type: 'system_alert',
        data: { requestId: requestId.toString() }
      });
    }

  } catch (error) {
    console.error('Matching engine error:', error);
  }
};

/**
 * Match owner's new availability to existing customer requests
 */
exports.matchAvailabilityToRequests = async (serviceId) => {
  try {
    const service = await RentalService.findById(serviceId).populate('routeConfigId');
    if (!service || !service.routeConfigId) return;

    const { availableDates } = service;
    const cfg = service.routeConfigId;

    // Find open requests that match the vehicle type and are on the newly available dates (ignoring time component)
    const dateConditions = (availableDates || []).map(d => {
      const start = new Date(d);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      return { date: { $gte: start, $lte: end } };
    });

    const query = {
      status: 'open',
      vehicleType: { $in: getEquivalentVehicleTypes(cfg.vehicleType) },
      peopleCount: { $lte: cfg.capacity }
    };

    if (dateConditions.length > 0) {
      query.$or = dateConditions;
    } else {
      query._id = null; // Do not match any requests if there are no available dates
    }

    const requests = await RentalRequest.find(query);

    console.log(`🔄 Matching availability for owner ${service.ownerId} against ${requests.length} potential requests`);

    for (const req of requests) {
      await this.matchRequestToOwners(req._id);
    }
  } catch (error) {
    console.error('Availability matching error:', error);
  }
};

/**
 * Match owner's new route config to existing customer requests
 */
exports.matchServiceToRequests = async (configId) => {
  try {
    const cfg = await OwnerRouteConfig.findById(configId);
    if (!cfg) return;

    const requests = await RentalRequest.find({
      status: 'open',
      vehicleType: { $in: getEquivalentVehicleTypes(cfg.vehicleType) },
      peopleCount: { $lte: cfg.capacity }
    });

    for (const req of requests) {
      await this.matchRequestToOwners(req._id);
    }
  } catch (error) {
    console.error('Service matching error:', error);
  }
};
