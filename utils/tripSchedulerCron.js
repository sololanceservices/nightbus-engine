const mongoose = require('mongoose');
const Route = mongoose.model('Route');
const TripTimeline = mongoose.model('TripTimeline');

// Runs daily at midnight to generate TripTimelines for tomorrow
exports.generateDailyTrips = async () => {
    try {
        console.log('[CRON] Starting daily TripTimeline generation for tomorrow...');

        // Calculate tomorrow's date
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0); // Start of tomorrow in local server time

        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const tomorrowDayString = daysOfWeek[tomorrow.getDay()];

        // Find all active routes
        const routes = await Route.find({ isActive: true, status: 'active' });

        let createdCount = 0;

        for (const route of routes) {
            // Check if route operates tomorrow
            if (route.scheduleType === 'specific-days' && !route.days.includes(tomorrowDayString)) {
                continue;
            }

            // Ensure route has rounds
            if (!route.rounds || route.rounds.length === 0) {
                // Backward compatibility if no rounds exist but departureTime does
                if (route.departureTime) {
                    route.rounds = [{ startTime: route.departureTime, roundLabel: 'Standard Round', isActive: true }];
                } else {
                    continue;
                }
            }

            for (const round of route.rounds) {
                if (!round.isActive) continue;

                // Check if timeline already exists to avoid duplicates
                const existingTrip = await TripTimeline.findOne({
                    routeId: route._id,
                    serviceDate: tomorrow,
                    tripNumber: round.roundLabel || `Round-${round.startTime}`
                });

                if (existingTrip) continue;

                // Create Stops array
                const [startHour, startMin] = round.startTime.split(':').map(Number);
                let currentScheduledTime = new Date(tomorrow);
                currentScheduledTime.setHours(startHour, startMin, 0, 0);

                const stops = route.stops.map((rs, index) => {
                    // Create a copy of the time
                    const scheduledArrival = new Date(currentScheduledTime.getTime());

                    // Add estimated travel time to the NEXT stop for the next iteration
                    // Assuming roughly 15 minutes between stops if no custom logic exists
                    currentScheduledTime.setMinutes(currentScheduledTime.getMinutes() + 15 + (rs.stopDuration || 0));

                    return {
                        stopId: rs._id || rs.name,
                        name: rs.name,
                        coordinates: {
                            latitude: rs.coordinates.latitude,
                            longitude: rs.coordinates.longitude
                        },
                        geofenceRadius: rs.geofenceRadius || 200,
                        order: rs.sequence || index,
                        scheduledArrival,
                        status: 'pending'
                    };
                });

                const timeline = new TripTimeline({
                    routeId: route._id,
                    busId: route.busId,
                    tripNumber: round.roundLabel || `Round-${round.startTime}`,
                    serviceDate: tomorrow,
                    status: 'scheduled',
                    bookingCutoffMinutes: 30, // Default 30 min cutoff
                    stops
                });

                await timeline.logEvent('trip_scheduled', `System automatically scheduled trip for tomorrow.`);
                await timeline.save();
                createdCount++;
            }
        }

        console.log(`[CRON] Successfully generated ${createdCount} trips for ${tomorrow.toDateString()}.`);

    } catch (error) {
        console.error('[CRON] Error generating daily trips:', error);
    }
};
