// ==================== server/services/recommendationService.js ====================
const Route = require('../models/Route');
const Journey = require('../models/Journey');

/**
 * Get similar journeys for a cancelled booking
 * @param {string} from - Departure location
 * @param {string} to - Destination location
 * @param {Date} date - Preferred travel date
 * @param {number} passengers - Number of passengers
 */
exports.getSimilarJourneys = async (from, to, date, passengers = 1) => {
  try {
    const travelDate = new Date(date);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][travelDate.getDay()];

    // Search for direct routes on the same day
    const directRoutes = await Route.find({
      isActive: true,
      days: dayName,
      $and: [
        { 'stops.name': new RegExp(`^${from}$`, 'i') },
        { 'stops.name': new RegExp(`^${to}$`, 'i') }
      ]
    }).populate('busId');

    const recommended = [];

    for (const route of directRoutes) {
      const fromIndex = route.stops.findIndex(s => s.name.toLowerCase() === from.toLowerCase());
      const toIndex = route.stops.findIndex(s => s.name.toLowerCase() === to.toLowerCase());

      if (fromIndex < toIndex) {
        for (const round of (route.rounds || [])) {
          if (!round.isActive) continue;

          // Simple availability check
          // (In a real scenario, we'd check segments, but for recommendations, 
          // we just want to show options that exist)
          
          recommended.push({
            type: 'direct',
            busName: route.busId.busNumber,
            busType: route.busId.busType,
            departureTime: adjustTime(route.stops[fromIndex].departureTime, round.startTime, route.stops[0].departureTime),
            arrivalTime: adjustTime(route.stops[toIndex].arrivalTime, round.startTime, route.stops[0].departureTime),
            price: route.basePrice,
            routeId: route._id
          });
        }
      }
    }

    // Sort by departure time
    return recommended.sort((a, b) => a.departureTime.localeCompare(b.departureTime)).slice(0, 5);
  } catch (error) {
    console.error('[RECOMMENDATION ERROR]', error);
    return [];
  }
};

function adjustTime(stopTime, roundStart, firstStopDep) {
  const [h1, m1] = firstStopDep.split(':').map(Number);
  const [h2, m2] = roundStart.split(':').map(Number);
  const offset = (h2 * 60 + m2) - (h1 * 60 + m1);

  const [h, m] = stopTime.split(':').map(Number);
  let total = h * 60 + m + offset;
  total = (total + 1440) % 1440;

  const resH = Math.floor(total / 60);
  const resM = total % 60;
  return `${String(resH).padStart(2, '0')}:${String(resM).padStart(2, '0')}`;
}
