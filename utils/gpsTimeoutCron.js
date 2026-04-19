const mongoose = require('mongoose');
const TripTimeline = mongoose.model('TripTimeline');

// Function that should be called periodically (e.g., every 5 minutes by a cron job)
exports.checkGpsTimeouts = async () => {
    try {
        console.log('Running GPS timeout check...');
        const timeoutMinutes = 15; // Define threshold
        const cutoffTime = new Date(Date.now() - timeoutMinutes * 60000);

        // Find all running trips where lastGpsPing is older than the cutoff
        // and isn't already marked as lost
        const timedOutTrips = await TripTimeline.find({
            status: 'running',
            isGpsLost: false,
            $or: [
                { lastGpsPing: { $lt: cutoffTime } },
                { lastGpsPing: { $exists: false } }
            ]
        });

        for (const trip of timedOutTrips) {
            trip.isGpsLost = true;
            // Get last known location for context if possible
            let location = null;
            if (trip.eventLogs && trip.eventLogs.length > 0) {
                const lastEvent = trip.eventLogs[trip.eventLogs.length - 1];
                location = lastEvent.location;
            }

            await trip.logEvent('gps_loss', `GPS connection lost for >${timeoutMinutes} minutes`, null, location);
            console.log(`GPS Lost logged for Trip: ${trip._id}`);
        }

    } catch (error) {
        console.error('Error checking GPS timeouts:', error);
    }
};
