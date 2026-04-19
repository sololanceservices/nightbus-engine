const Location = require('../models/Location');
const Route = require('../models/Route');

// Helper: Calculate distance between two coordinates in KM
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Search locations with hybrid DB + Photon search and nearest stop mapping
exports.searchLocations = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json({ success: true, locations: [] });
    }

    const searchQuery = query.toLowerCase().trim();

    // 1. Get all "Official Bus Stops" for nearest stop mapping
    const busStops = await Location.find({
      isActive: true,
      type: { $in: ['stop', 'boarding_stop', 'drop_stop'] }
    }).select('name coordinates type').lean();

    // 2. Local DB Search (Prefix, Contains, Text)
    const baseFilter = {
      isActive: true,
      $or: [
        { isGlobal: true },
        ...(req.user ? [{ createdBy: req.user._id }] : [])
      ]
    };

    let localResults = await Location.find({
      ...baseFilter,
      $or: [
        { name: new RegExp(`^${searchQuery}`, 'i') },
        { aliases: new RegExp(`^${searchQuery}`, 'i') }
      ]
    })
      .select('name state type coordinates popularity')
      .sort({ popularity: -1, name: 1 })
      .limit(limit)
      .lean();

    if (localResults.length < limit) {
      const moreLocal = await Location.find({
        ...baseFilter,
        _id: { $nin: localResults.map(l => l._id) },
        $or: [
          { name: new RegExp(searchQuery, 'i') },
          { aliases: new RegExp(searchQuery, 'i') }
        ]
      })
        .select('name state type coordinates popularity')
        .sort({ popularity: -1, name: 1 })
        .limit(limit - localResults.length)
        .lean();
      localResults = [...localResults, ...moreLocal];
    }

    if (localResults.length < limit) {
      const textSearchLocal = await Location.find({
        ...baseFilter,
        _id: { $nin: localResults.map(l => l._id) },
        $text: { $search: searchQuery }
      })
        .select('name state type coordinates popularity')
        .limit(limit - localResults.length)
        .lean();
      localResults = [...localResults, ...textSearchLocal];
    }

    // 3. Photon External Search (Typo tolerant, general locations)
    let externalResults = [];
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=5&lat=22.5&lon=79.5&lang=en`;
      const response = await fetch(photonUrl);
      if (response.ok) {
        const data = await response.json();
        externalResults = (data.features || []).map(f => ({
          name: f.properties.name || f.properties.city || f.properties.street,
          state: f.properties.state || f.properties.city,
          type: 'external',
          coordinates: {
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0]
          },
          external: true
        })).filter(r => r.name);
      }
    } catch (err) {
      console.warn('⚠️ Photon API failed:', err.message);
    }

    // 4. Merge results and map to nearest stop
    const allCandidates = [...localResults, ...externalResults];
    const resultsMap = new Map();

    allCandidates.forEach(cand => {
      const key = `${cand.name.toLowerCase()}-${cand.state?.toLowerCase() || ''}`;
      if (!resultsMap.has(key) || cand.type !== 'external') {
        // Find nearest bus stop
        let nearestStop = null;
        let minDistance = Infinity;
        const isBusStop = ['stop', 'boarding_stop', 'drop_stop'].includes(cand.type);

        if (!isBusStop && busStops.length > 0 && cand.coordinates) {
          busStops.forEach(stop => {
            const dist = calculateDistance(
              cand.coordinates.latitude, cand.coordinates.longitude,
              stop.coordinates.latitude, stop.coordinates.longitude
            );
            if (dist < minDistance) {
              minDistance = dist;
              nearestStop = {
                name: stop.name,
                distance: Math.round(dist * 10) / 10,
                id: stop._id
              };
            }
          });
        }

        resultsMap.set(key, {
          id: cand._id || `ext-${key}`,
          name: cand.name,
          state: cand.state,
          type: cand.type,
          coordinates: cand.coordinates,
          isBusStop,
          nearestStop: minDistance < 50 ? nearestStop : null // Only show if within 50km
        });
      }
    });

    res.json({
      success: true,
      locations: Array.from(resultsMap.values()).slice(0, limit)
    });

  } catch (error) {
    console.error('❌ Location search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get popular locations
exports.getPopularLocations = async (req, res) => {
  try {
    const locations = await Location.find({ isActive: true })
      .select('name state type popularity')
      .sort({ popularity: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      locations: locations.map(loc => ({
        id: loc._id,
        name: loc.name,
        state: loc.state,
        type: loc.type,
        coordinates: loc.coordinates
      }))
    });

  } catch (error) {
    console.error('❌ Popular locations error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Parse speech input (for voice search)
exports.parseSpeech = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    const cleanText = text.toLowerCase().trim();

    // Extract location using NLP patterns
    const location = await extractLocationFromText(cleanText);

    res.json({
      success: true,
      location: location,
      originalText: text
    });

  } catch (error) {
    console.error('❌ Speech parsing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to extract location from natural language
async function extractLocationFromText(text) {
  // Common Hindi/English patterns
  const patterns = [
    // Hindi: "jabalpur se indore jana hai"
    /(\w+)\s+(?:se|से)\s+(\w+)/i,
    // English: "from delhi to mumbai"
    /from\s+(\w+)\s+to\s+(\w+)/i,
    // Simple: "going to pune"
    /(?:going\s+to|jana\s+hai|जाना\s+है)\s+(\w+)/i,
    // Just city names
    /(\w+)\s+(?:city|नगर|शहर)/i
  ];

  // Try to extract using patterns
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const cityName = match[1] || match[2];

      // Search in database
      const location = await Location.findOne({
        isActive: true,
        $or: [
          { name: new RegExp(`^${cityName}`, 'i') },
          { aliases: new RegExp(cityName, 'i') }
        ]
      }).select('name').lean();

      if (location) {
        return location.name;
      }
    }
  }

  // If no pattern matched, try direct word matching
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3) {
      const location = await Location.findOne({
        isActive: true,
        $or: [
          { name: new RegExp(`^${word}`, 'i') },
          { aliases: new RegExp(word, 'i') }
        ]
      }).select('name').lean();

      if (location) {
        return location.name;
      }
    }
  }

  return null;
}

// Create a new location (Landmark)
exports.createLocation = async (req, res) => {
  try {
    const { name, coordinates, type = 'stop', state = '', district = '' } = req.body;

    if (!name || !coordinates?.latitude || !coordinates?.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Name and valid coordinates are required'
      });
    }

    // Check if a location with the same name already exists for this user
    const existing = await Location.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      $or: [
        { createdBy: req.user._id },
        { isGlobal: true }
      ]
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Using existing landmark',
        location: {
          id: existing._id,
          name: existing.name,
          coordinates: existing.coordinates,
          type: existing.type
        }
      });
    }

    const newLocation = new Location({
      name: name.trim(),
      coordinates,
      type,
      state,
      district,
      createdBy: req.user._id,
      isGlobal: true // Make visible to everyone so other users can see it
    });

    await newLocation.save();

    res.status(201).json({
      success: true,
      message: 'Landmark created successfully',
      location: {
        id: newLocation._id,
        name: newLocation.name,
        coordinates: newLocation.coordinates,
        type: newLocation.type
      }
    });

  } catch (error) {
    console.error('❌ Create location error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  searchLocations: exports.searchLocations,
  getPopularLocations: exports.getPopularLocations,
  parseSpeech: exports.parseSpeech,
  createLocation: exports.createLocation
};