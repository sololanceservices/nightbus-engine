// ==================== services/rentalMatchingService.js ====================
const RentalRequest = require('../models/RentalRequest');
const OwnerRouteConfig = require('../models/OwnerRouteConfig');
const RentalMatch = require('../models/RentalMatch');
const Location = require('../models/Location');
const { sendNotification } = require('../utils/notifications');

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
 * Core matching engine to find matches for a rental request
 * Designed to be run proactively when a request is created.
 */
exports.matchRequestToOwners = async (requestId) => {
  try {
    const request = await RentalRequest.findById(requestId).populate('userId', 'name');
    if (!request) return;

    console.log(`🔍 Running matching engine for request ${requestId} (${request.from} -> ${request.to})`);

    // 1. Get coordinates for request source/dest
    const [fromLoc, toLoc] = await Promise.all([
      Location.findOne({ name: new RegExp(`^${request.from}$`, 'i') }),
      Location.findOne({ name: new RegExp(`^${request.to}$`, 'i') })
    ]);

    // 2. Query configurations (exact name match first, then proximity)
    // For 10k users, we optimize by indexing the route configs
    const configs = await OwnerRouteConfig.find({
      isActive: true,
      vehicleType: request.vehicleType,
      capacity: { $gte: request.peopleCount }
    }).populate('ownerId', 'name fcmToken fcmTokens');

    const matches = [];

    for (const cfg of configs) {
      let score = 0;
      let matchType = 'similarity';

      // City Name Similarity (Case-insensitive)
      const fromMatch = cfg.from.toLowerCase() === request.from.toLowerCase();
      const pathMatch = cfg.to.toLowerCase() === request.to.toLowerCase();

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
 * Match owner's new listing to existing customer requests
 */
exports.matchServiceToRequests = async (configId) => {
  // Logic works similarly but in reverse
  // Finds open requests that match the new config
  try {
    const cfg = await OwnerRouteConfig.findById(configId);
    if (!cfg) return;

    const requests = await RentalRequest.find({
      status: 'open',
      vehicleType: cfg.vehicleType,
      peopleCount: { $lte: cfg.capacity }
    });

    for (const req of requests) {
      // Re-use logic or call main engine for each
      // (Optimization: main engine handles specific request)
      await this.matchRequestToOwners(req._id);
    }
  } catch (error) {
    console.error('Service matching error:', error);
  }
};
