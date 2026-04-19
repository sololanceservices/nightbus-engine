// ==================== server/services/autoCancelService.js ====================
const Segment = require('../models/Segment');
const Journey = require('../models/Journey');
const Wallet = require('../models/Wallet');
const { sendNotification } = require('../utils/notifications');

/**
 * AUTO-CANCEL SERVICE
 * Scans for 'requested' or 'pending_approval' segments older than 1 hour
 * and automatically cancels them, triggering a wallet refund.
 */
const autoCancelStaleBookings = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 1. Find stale segments
    const staleSegments = await Segment.find({
      status: { $in: ['requested', 'pending_approval'] },
      createdAt: { $lt: oneHourAgo }
    }).populate('journeyId');

    if (staleSegments.length === 0) return;

    console.log(`[AUTO-CANCEL] Found ${staleSegments.length} stale segments to cancel`);

    for (const segment of staleSegments) {
      // 2. Mark segment as cancelled
      segment.status = 'cancelled';
      segment.rejectionReason = 'Auto-cancelled: Bus owner did not take action within 1 hour';
      segment.approvalStatus = 'rejected';
      await segment.save();

      // 3. Check if all segments in the journey are cancelled
      if (segment.journeyId) {
        const journey = await Journey.findById(segment.journeyId._id || segment.journeyId).populate('segments');
        if (journey) {
          const allCancelled = journey.segments.every(s => s.status === 'cancelled');

          if (allCancelled) {
            journey.status = 'cancelled';
            journey.cancellationReason = 'Owner did not take action';
            journey.cancellationDate = new Date();
            await journey.save();
          }

          // 4. Refund to wallet
          const refundAmount = segment.totalAmount;
          if (refundAmount > 0) {
            try {
              // Perform atomic refund
              await Wallet.atomicRefund(segment.customerId, refundAmount, {
                transactionId: `ACRFD${Date.now()}`,
                reason: `Auto-refund for booking #${journey.bookingRef}`,
                bookingId: journey._id,
                description: `Auto-cancellation refund: Owner did not take action`
              });
            } catch (walletError) {
              console.error(`[AUTO-CANCEL] Refund failed for User ${segment.customerId}:`, walletError.message);
            }
          }

          // 5. Notify customer
          await sendNotification(segment.customerId, {
            title: 'Booking Auto-Cancelled ⚠️',
            body: `Your booking for ${segment.fromStop.name} was auto-cancelled as the owner didn't respond. ${refundAmount > 0 ? 'Full refund processed to your wallet.' : ''}`,
            type: 'system_alert',
            data: {
              journeyId: journey._id,
              screen: 'BookingDetails'
            }
          }).catch(err => console.warn('⚠️ Notification failed:', err.message));
        }
      }
    }

    console.log('[AUTO-CANCEL] Process completed');
  } catch (error) {
    console.error('[AUTO-CANCEL ERROR]', error);
  }
};

exports.autoCancelStaleBookings = autoCancelStaleBookings;

/**
 * START THE AUTO-CANCEL JOB
 * Runs every 5 minutes
 */
exports.initAutoCancelJob = () => {
  console.log('[JOBS] Initializing Auto-Cancel background job (Every 5 mins)');

  // Run immediately on start
  autoCancelStaleBookings();

  // Schedule intervals
  setInterval(autoCancelStaleBookings, 5 * 60 * 1000);
};
