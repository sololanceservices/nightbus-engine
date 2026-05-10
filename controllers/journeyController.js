// ==================== controllers/journeyController.js (ENHANCED) ====================
const Route = require('../models/Route');
const Segment = require('../models/Segment');
const Journey = require('../models/Journey');

/**
 * SMART JOURNEY SEARCH
 * - Finds direct routes
 * - Automatically generates 2-3 segment connecting routes
 * - Validates buffer times (30-60 minutes minimum)
 * - Presents connecting journey as single card to customer
 * - Creates internal segments for each bus leg
 */
exports.searchJourneys = async (req, res) => {
  try {
    const { from, to, date, passengers } = req.body;

    if (!from || !to || !date || !passengers) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: from, to, date, passengers'
      });
    }

    const travelDate = new Date(date);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      travelDate.getDay()
    ];

    const journeys = [];

    // 1. SEARCH DIRECT ROUTES
    console.log(`[JOURNEY SEARCH] Searching direct routes: ${from} -> ${to}`);
    const directJourneys = await findDirectJourneys(from, to, dayName, passengers);
    journeys.push(...directJourneys);

    // 2. SEARCH 2-SEGMENT CONNECTING ROUTES
    console.log(`[JOURNEY SEARCH] Searching 2-segment routes...`);
    const twoSegmentJourneys = await findConnectingJourneys(
      from,
      to,
      dayName,
      passengers,
      2
    );
    journeys.push(...twoSegmentJourneys);

    // 3. SEARCH 3-SEGMENT CONNECTING ROUTES
    console.log(`[JOURNEY SEARCH] Searching 3-segment routes...`);
    const threeSegmentJourneys = await findConnectingJourneys(
      from,
      to,
      dayName,
      passengers,
      3
    );
    journeys.push(...threeSegmentJourneys);

    // 4. SORT BY PRICE, THEN BY SEGMENTS, THEN BY DURATION
    journeys.sort((a, b) => {
      if (a.totalPrice !== b.totalPrice) {
        return a.totalPrice - b.totalPrice;
      }
      if (a.segments !== b.segments) {
        return a.segments - b.segments;
      }
      return a.totalDurationMinutes - b.totalDurationMinutes;
    });

    // 5. IF NO JOURNEYS FOUND, SUGGEST NEXT AVAILABLE
    let suggestedDate = null;
    if (journeys.length === 0) {
      suggestedDate = await findNextAvailableDate(from, to, travelDate);
    }

    res.json({
      success: true,
      count: journeys.length,
      journeys: journeys.slice(0, 10), // Top 10 results
      suggestion:
        suggestedDate && journeys.length === 0
          ? {
            message: `No buses available on ${date}`,
            nextAvailableDate: suggestedDate,
            hint: 'Earliest available bus on this route'
          }
          : null
    });
  } catch (error) {
    console.error('[JOURNEY SEARCH ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Find direct journeys (single bus, no transfers)
 */
async function findDirectJourneys(from, to, dayName, passengers) {
  const journeys = [];

  try {
    // Find routes that have both from and to
    const directRoutes = await Route.find({
      isActive: true,
      days: dayName,
      'stops.name': { $all: [new RegExp(from, 'i'), new RegExp(to, 'i')] }
    }).populate({
      path: 'busId',
      populate: { path: 'ownerId', select: 'ownerSettings' }
    });

    for (const route of directRoutes) {
      const fromIndex = route.stops.findIndex(
        s => s.name.toLowerCase().includes(from.toLowerCase())
      );
      const toIndex = route.stops.findIndex(s => s.name.toLowerCase().includes(to.toLowerCase()));

      if (fromIndex < toIndex) {
        // Loop through each active round
        for (const round of (route.rounds || [])) {
          if (!round.isActive) continue;

          // Calculate the time offset between the master stop time and this round's start time
          const firstStopDep = route.stops[0].departureTime;
          const roundStart = round.startTime;
          const offsetMinutes = getTimeDifferenceMinutes(firstStopDep, roundStart);

          // Adjust times for this specific round
          const departureTime = adjustTimeByMinutes(route.stops[fromIndex].departureTime, offsetMinutes);
          const arrivalTime = adjustTimeByMinutes(route.stops[toIndex].arrivalTime, offsetMinutes);

          // Check seat availability specifically for THIS round
          const bookedSeats = await Segment.countDocuments({
            routeId: route._id,
            roundStartTime: round.startTime, // Round-specific check
            status: { $in: ['confirmed', 'boarded', 'completed'] }
          });

          const availableSeats = route.busId.totalSeats - bookedSeats;

          if (availableSeats >= passengers) {
            const basePrice = calculateSegmentPrice(route, fromIndex, toIndex);
            
            // Get auto-confirm from owner settings
            const autoConfirm = route.busId.ownerId?.ownerSettings?.autoConfirmBookings ?? true;

            journeys.push({
              journeyId: `DIRECT-${route._id}-${round.startTime}-${Date.now()}`,
              type: 'direct',
              segments: 1,
              roundLabel: round.roundLabel || `Round at ${round.startTime}`,
              roundStartTime: round.startTime,
              autoConfirm,
              legs: [
                {
                  segmentNumber: 1,
                  routeId: route._id,
                  busId: route.busId._id,
                  chassisNumber: route.busId.chassisNumber,
                  busType: route.busId.busType || 'Standard',
                  from,
                  to,
                  departureTime,
                  arrivalTime,
                  roundStartTime: round.startTime,
                  duration: calculateDuration(departureTime, arrivalTime),
                  durationMinutes: getTimeDifferenceMinutes(departureTime, arrivalTime),
                  availableSeats,
                  pricePerPerson: basePrice,
                  totalPrice: basePrice * passengers,
                  autoConfirm
                }
              ],
              totalPrice: basePrice * passengers,
              totalDurationMinutes: getTimeDifferenceMinutes(departureTime, arrivalTime),
              availability: availableSeats,
              stops: {
                count: route.stops.length,
                intermediate: route.stops
                  .slice(fromIndex + 1, toIndex)
                  .map(s => s.name)
              }
            });
          }
        }
      }
    }

    console.log(
      `[DIRECT JOURNEYS] Found ${journeys.length} direct routes: ${from} -> ${to}`
    );
    return journeys;
  } catch (error) {
    console.error('[DIRECT JOURNEY ERROR]', error);
    return journeys;
  }
}

/**
 * Find connecting journeys (2 or 3 segments)
 */
async function findConnectingJourneys(
  from,
  to,
  dayName,
  passengers,
  maxSegments
) {
  const journeys = [];

  try {
    if (maxSegments === 2) {
      // Find 2-segment journeys (A -> B -> C)
      const intermediates = await findIntermediateStops(from, to, dayName);

      for (const intermediate of intermediates) {
        const leg1 = await findLegs(from, intermediate, dayName, passengers);
        const leg2 = await findLegs(intermediate, to, dayName, passengers);

        for (const route1 of leg1) {
          for (const route2 of leg2) {
            // Validate buffer time (30-60 minutes)
            const bufferMinutes = getTimeDifferenceMinutes(
              route1.arrivalTime,
              route2.departureTime
            );

            if (bufferMinutes >= 30 && bufferMinutes <= 180) {
              const totalPrice =
                (route1.pricePerPerson + route2.pricePerPerson) * passengers;
              const totalDuration = calculateDuration(
                route1.departureTime,
                route2.arrivalTime
              );

              journeys.push({
                journeyId: `2SEG-${route1.routeId}-${route2.routeId}-${Date.now()}`,
                type: 'connecting',
                segments: 2,
                legs: [
                  {
                    segmentNumber: 1,
                    ...route1,
                    totalPrice: route1.pricePerPerson * passengers
                  },
                  {
                    segmentNumber: 2,
                    ...route2,
                    totalPrice: route2.pricePerPerson * passengers,
                    bufferTime: bufferMinutes,
                    bufferWarning:
                      bufferMinutes < 45
                        ? 'Tight connection - only ' + bufferMinutes + ' mins'
                        : null
                  }
                ],
                totalPrice,
                totalDurationMinutes: getTimeDifferenceMinutes(
                  route1.departureTime,
                  route2.arrivalTime
                ),
                connectionPoint: intermediate,
                bufferMinutes,
                availability: Math.min(route1.availableSeats, route2.availableSeats)
              });
            }
          }
        }
      }
    } else if (maxSegments === 3) {
      // Find 3-segment journeys (A -> B -> C -> D)
      const firstLegs = await findLegs(from, null, dayName, passengers);

      for (const leg1 of firstLegs) {
        const secondLegs = await findLegs(leg1.to, null, dayName, passengers);

        for (const leg2 of secondLegs) {
          // Check first buffer
          const buffer1 = getTimeDifferenceMinutes(
            leg1.arrivalTime,
            leg2.departureTime
          );

          if (buffer1 >= 30 && buffer1 <= 180) {
            const finalLegs = await findLegs(leg2.to, to, dayName, passengers);

            for (const leg3 of finalLegs) {
              const buffer2 = getTimeDifferenceMinutes(
                leg2.arrivalTime,
                leg3.departureTime
              );

              if (buffer2 >= 30 && buffer2 <= 180) {
                const totalPrice =
                  (leg1.pricePerPerson +
                    leg2.pricePerPerson +
                    leg3.pricePerPerson) *
                  passengers;

                journeys.push({
                  journeyId: `3SEG-${leg1.routeId}-${leg2.routeId}-${leg3.routeId}-${Date.now()}`,
                  type: 'connecting',
                  segments: 3,
                  legs: [
                    {
                      segmentNumber: 1,
                      ...leg1,
                      totalPrice: leg1.pricePerPerson * passengers
                    },
                    {
                      segmentNumber: 2,
                      ...leg2,
                      totalPrice: leg2.pricePerPerson * passengers,
                      bufferTime: buffer1
                    },
                    {
                      segmentNumber: 3,
                      ...leg3,
                      totalPrice: leg3.pricePerPerson * passengers,
                      bufferTime: buffer2
                    }
                  ],
                  totalPrice,
                  totalDurationMinutes: getTimeDifferenceMinutes(
                    leg1.departureTime,
                    leg3.arrivalTime
                  ),
                  connectionPoints: [leg1.to, leg2.to],
                  bufferMinutes: [buffer1, buffer2]
                });
              }
            }
          }
        }
      }
    }

    console.log(
      `[CONNECTING JOURNEYS] Found ${journeys.length} ${maxSegments}-segment routes`
    );
    return journeys;
  } catch (error) {
    console.error('[CONNECTING JOURNEY ERROR]', error);
    return journeys;
  }
}

/**
 * Find individual route legs
 */
async function findLegs(from, to, dayName, passengers) {
  const legs = [];

  try {
    const query = {
      isActive: true,
      days: dayName
    };

    if (to) {
      query['stops.name'] = { $all: [new RegExp(from, 'i'), new RegExp(to, 'i')] };
    } else {
      query['stops.name'] = new RegExp(from, 'i');
    }

    const routes = await Route.find(query).populate('busId');

    for (const route of routes) {
      const fromIndex = route.stops.findIndex(
        s => s.name.toLowerCase().includes(from.toLowerCase())
      );
      if (fromIndex === -1) continue;

      let toIndex = -1;
      if (to) {
        toIndex = route.stops.findIndex(s => s.name.toLowerCase().includes(to.toLowerCase()));
        if (toIndex === -1 || toIndex <= fromIndex) continue;
      } else {
        // Return all possible destinations from this stop
        for (let i = fromIndex + 1; i < route.stops.length; i++) {
          const toName = route.stops[i].name;
          const bookedSeats = await Segment.countDocuments({
            routeId: route._id,
            status: { $in: ['confirmed', 'boarded', 'completed'] }
          });

          const availableSeats = route.busId.totalSeats - bookedSeats;

          if (availableSeats >= passengers) {
            legs.push({
              routeId: route._id,
              busId: route.busId._id,
              chassisNumber: route.busId.chassisNumber,
              busType: route.busId.busType || 'Standard',
              from,
              to: toName,
              departureTime: route.stops[fromIndex].departureTime,
              arrivalTime: route.stops[i].arrivalTime,
              duration: calculateDuration(
                route.stops[fromIndex].departureTime,
                route.stops[i].arrivalTime
              ),
              durationMinutes: getTimeDifferenceMinutes(
                route.stops[fromIndex].departureTime,
                route.stops[i].arrivalTime
              ),
              availableSeats,
              pricePerPerson: calculateSegmentPrice(route, fromIndex, i)
            });
          }
        }
        return legs;
      }

      if (availableSeats >= passengers) {
        // Iterate through rounds
        for (const round of (route.rounds || [])) {
          if (!round.isActive) continue;

          const firstStopDep = route.stops[0].departureTime;
          const offsetMinutes = getTimeDifferenceMinutes(firstStopDep, round.startTime);

          const departureTime = adjustTimeByMinutes(route.stops[fromIndex].departureTime, offsetMinutes);
          const arrivalTime = adjustTimeByMinutes(route.stops[toIndex].arrivalTime, offsetMinutes);

          // Availability check per round
          const bookedInRound = await Segment.countDocuments({
            routeId: route._id,
            roundStartTime: round.startTime,
            status: { $in: ['confirmed', 'boarded', 'completed'] }
          });
          const availableInRound = route.busId.totalSeats - bookedInRound;

          if (availableInRound >= passengers) {
            legs.push({
              routeId: route._id,
              busId: route.busId._id,
              chassisNumber: route.busId.chassisNumber,
              busType: route.busId.busType || 'Standard',
              from,
              to,
              departureTime,
              arrivalTime,
              roundStartTime: round.startTime,
              duration: calculateDuration(departureTime, arrivalTime),
              durationMinutes: getTimeDifferenceMinutes(departureTime, arrivalTime),
              availableSeats: availableInRound,
              pricePerPerson: calculateSegmentPrice(route, fromIndex, toIndex)
            });
          }
        }
      }
    }

    return legs;
  } catch (error) {
    console.error('[FIND LEGS ERROR]', error);
    return legs;
  }
}

/**
 * Find next available date for a route
 */
async function findNextAvailableDate(from, to, startDate) {
  try {
    for (let i = 1; i <= 30; i++) {
      // Check next 30 days
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dayName = [
        'Sun',
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat'
      ][checkDate.getDay()];

      const routes = await Route.find({
        isActive: true,
        days: dayName,
        'stops.name': { $all: [new RegExp(from, 'i'), new RegExp(to, 'i')] }
      }).lean();

      if (routes.length > 0) {
        return checkDate.toISOString().split('T')[0];
      }
    }

    return null;
  } catch (error) {
    console.error('[NEXT AVAILABLE DATE ERROR]', error);
    return null;
  }
}

/**
 * Find all intermediate stops between two cities
 */
async function findIntermediateStops(from, to, dayName) {
  const intermediates = new Set();

  try {
    const routes = await Route.find({
      isActive: true,
      days: dayName
    });

    for (const route of routes) {
      const stops = route.stops.map(s => s.name);
      const fromIdx = stops.findIndex(n => n.toLowerCase().includes(from.toLowerCase()));
      const toIdx = stops.findIndex(n => n.toLowerCase().includes(to.toLowerCase()));

      if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
        // Found a route with both cities
        for (let i = fromIdx + 1; i < toIdx; i++) {
          intermediates.add(stops[i]);
        }
      }
    }

    return Array.from(intermediates);
  } catch (error) {
    console.error('[INTERMEDIATE STOPS ERROR]', error);
    return [];
  }
}

/**
 * Calculate price for a segment (between two stops)
 */
function calculateSegmentPrice(route, fromIndex, toIndex) {
  try {
    const segments = toIndex - fromIndex;
    const basePrice = route.basePrice || 500;
    const pricePerSegment = (route.pricePerKm || 2) * 50; // ~50km per segment
    return basePrice + pricePerSegment * segments;
  } catch (error) {
    return route.basePrice || 500;
  }
}

/**
 * Calculate time difference in minutes
 */
function getTimeDifferenceMinutes(time1, time2) {
  try {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);

    // Handle overnight journeys
    if (diff < 0) {
      diff += 24 * 60;
    }

    return diff;
  } catch {
    return 0;
  }
}

/**
 * Calculate human-readable duration
 */
function calculateDuration(startTime, endTime) {
  const minutes = getTimeDifferenceMinutes(startTime, endTime);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Adjust a time string (HH:MM) by a number of minutes
 */
function adjustTimeByMinutes(timeStr, minutes) {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    let totalMinutes = h * 60 + m + minutes;

    // Normalize to 24-hour cycle
    totalMinutes = totalMinutes % (24 * 60);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;

    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch {
    return timeStr;
  }
}


// ==================== ADDITIONAL ENDPOINTS ====================


// Calculate price for a journey
exports.calculatePrice = async (req, res) => {
  try {
    const {
      routeId,
      passengers,
      class: travelClass = 'economy'
    } = req.body;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    const basePricePerPerson = route.basePrice || 500;
    const classMultiplier = travelClass === 'premium' ? 1.5 : 1;

    const pricePerPerson = basePricePerPerson * classMultiplier;
    const baseTotal = pricePerPerson * (passengers || 1);
    const platformFee = baseTotal * 0.05;
    const taxes = baseTotal * 0.18;
    const finalPrice = baseTotal + platformFee + taxes;

    res.status(200).json({
      success: true,
      pricing: {
        basePrice: baseTotal,
        platformFee: parseFloat(platformFee.toFixed(2)),
        taxes: parseFloat(taxes.toFixed(2)),
        finalPrice: parseFloat(finalPrice.toFixed(2)),
        pricePerPerson: parseFloat(pricePerPerson.toFixed(2))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get journey by ID
exports.getJourneyById = async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.id).populate(
      'segments'
    );
    if (!journey) {
      return res.status(404).json({
        success: false,
        message: 'Journey not found'
      });
    }
    res.status(200).json({ success: true, journey });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user journeys
exports.getUserJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find({
      customerId: req.params.userId
    }).populate('segments');
    res.status(200).json({ success: true, journeys });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== Add this to controllers/journeyController.js ====================

/**
 * Get recommendations for a cancelled or unavailable journey
 */
const recommendationService = require('../services/recommendationService');

exports.getRecommendations = async (req, res) => {
  try {
    const { from, to, date, passengers } = req.body;
    
    if (!from || !to || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: from, to, date'
      });
    }

    const recommendations = await recommendationService.getSimilarJourneys(from, to, date, passengers || 1);

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('[RECOMMENDATIONS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get booked seats for a specific route and date
 */
exports.getBookedSeats = async (req, res) => {
  try {
    const { routeId, busId, travelDate, roundStartTime } = req.body;

    if (!routeId || !busId || !travelDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: routeId, busId, travelDate'
      });
    }

    // Find all segments (bookings) for this route and date
    const segments = await Segment.find({
      routeId,
      busId,
      travelDate: new Date(travelDate),
      roundStartTime,
      status: { $in: ['confirmed', 'boarded', 'requested'] } // Include requested for pending confirmations
    }).select('seatNumber');

    // Extract seat numbers (parse if they're labels like "1A")
    const bookedSeatNumbers = segments.map(seg => {
      const seatNum = seg.seatNumber;
      // If seat is like "1A", convert to number (row * 4 + col)
      if (typeof seatNum === 'string' && seatNum.match(/^\d+[A-D]$/)) {
        const row = parseInt(seatNum.match(/^\d+/)[0]);
        const col = seatNum.charCodeAt(seatNum.length - 1) - 65; // A=0, B=1, C=2, D=3
        return (row - 1) * 4 + col + 1;
      }
      return parseInt(seatNum);
    }).filter(num => !isNaN(num));

    res.json({
      success: true,
      bookedSeats: bookedSeatNumbers
    });

  } catch (error) {
    console.error('[BOOKED SEATS ERROR]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  searchJourneys: exports.searchJourneys,
  calculatePrice: exports.calculatePrice,
  getJourneyById: exports.getJourneyById,
  getUserJourneys: exports.getUserJourneys,
  getBookedSeats: exports.getBookedSeats,
  getRecommendations: exports.getRecommendations
};