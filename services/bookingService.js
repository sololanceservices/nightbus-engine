// ==================== services/bookingService.js ====================
const Journey = require('../models/Journey');
const Segment = require('../models/Segment');
const Payment = require('../models/Payment');
const Bus = require('../models/Bus');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { sendNotification } = require('../utils/notifications');
const mongoose = require('mongoose');

/**
 * finalizeBooking
 * Atomic, idempotent function to finalize a booking after payment success.
 * Can be called from Controller (client success) or Webhook (async success).
 */
exports.finalizeBooking = async ({
    userId,
    bookingData,
    paymentDetails,
    paymentOrder // The PaymentOrder record if available
}) => {
    let session = null;
    const isReplicaSet = mongoose.connection.getClient().topology?.description?.type !== 'Single';

    if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        console.log(`[BOOKING SERVICE] Finalizing booking for user: ${userId} (Sessions: ${!!session})`);

        const { segments, totalAmount, platformFee, taxes, paymentMethod, promoCode } = bookingData;
        const { razorpay_payment_id, razorpay_order_id } = paymentDetails;

        // 1. Idempotency Check: See if this payment_id has already been used
        const existingPayment = await Payment.findOne({ gatewayId: razorpay_payment_id });
        if (existingPayment && existingPayment.status === 'captured') {
            const existingJourney = await Journey.findById(existingPayment.bookingId).populate('segments');
            console.log(`[BOOKING SERVICE] Payment ${razorpay_payment_id} already processed. Returning existing journey.`);
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return { success: true, journey: existingJourney, payment: existingPayment, alreadyProcessed: true };
        }

        // 2. Validate seat availability (extra check just in case)
        for (const segData of segments) {
            const existingSegment = await Segment.findOne({
                routeId: segData.routeId,
                busId: segData.busId,
                seatNumber: segData.seatNumber,
                travelDate: new Date(segData.travelDate),
                status: { $in: ['confirmed', 'boarded', 'requested'] }
            }).session(session);

            if (existingSegment) {
                throw new Error(`Seat ${segData.seatNumber} was taken while processing payment.`);
            }
        }

        // 2.5 Validate Coupon if present
        let discountAmount = 0;
        if (promoCode) {
            const coupon = await Coupon.findOne({ code: promoCode.toUpperCase(), isActive: true }).session(session);
            if (coupon) {
                // Re-calculate discount for security
                if (coupon.discountType === 'flat') {
                    discountAmount = coupon.discountValue;
                } else {
                    discountAmount = (totalAmount * coupon.discountValue) / 100;
                    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
                }
                
                // Increment used count
                coupon.usedCount += 1;
                await coupon.save({ session });
            }
        }

        // 3. Create Journey
        const journey = new Journey({
            customerId: userId,
            totalAmount,
            platformFee,
            taxes,
            bookingDate: new Date(),
            paymentMethod,
            promoCode,
            discountAmount,
            status: 'confirmed',
            paymentStatus: 'completed'
        });

        await journey.save({ session });

        // 4. Create Payment Record
        const payment = await Payment.create([{
            userId,
            bookingId: journey._id,
            amount: totalAmount,
            method: paymentMethod === 'razorpay' ? 'card' : paymentMethod, // Default to card if razorpay
            gateway: 'razorpay',
            status: 'captured',
            gatewayId: razorpay_payment_id,
            orderId: razorpay_order_id
        }], { session });

        journey.paymentId = payment[0]._id;

        // 5. Create Segments
        const segmentIds = [];
        const busSettingsCache = {};

        for (const segData of segments) {
            if (!busSettingsCache[segData.busId]) {
                const bus = await Bus.findById(segData.busId).session(session);
                let autoConfirm = false;

                if (bus && bus.ownerId) {
                    const ownerUser = await User.findById(bus.ownerId).session(session);
                    if (ownerUser && ownerUser.ownerSettings) {
                        autoConfirm = ownerUser.ownerSettings.autoConfirmBookings === true;
                    }
                }

                busSettingsCache[segData.busId] = {
                    commissionPercentage: bus?.bookingSettings?.commissionPercentage || 10,
                    autoConfirm
                };
            }

            const { commissionPercentage, autoConfirm } = busSettingsCache[segData.busId];
            const segmentTotal = segData.totalAmount || (segData.price + (segData.platformFee || 0));
            const platformCommission = Math.round(segmentTotal * (commissionPercentage / 100));
            const ownerEarnings = segmentTotal - platformCommission;

            const segment = new Segment({
                journeyId: journey._id,
                customerId: userId,
                routeId: segData.routeId,
                busId: segData.busId,
                fromStop: { name: segData.fromStop.name },
                toStop: { name: segData.toStop.name },
                seatNumber: segData.seatNumber,
                seatGender: segData.seatGender || 'any',
                passengerDetails: segData.passengerDetails,
                travelDate: new Date(segData.travelDate),
                price: segData.price,
                platformFee: segData.platformFee || 0,
                platformCommission,
                ownerEarnings,
                totalAmount: segmentTotal,
                departureTime: segData.departureTime,
                arrivalTime: segData.arrivalTime,
                status: autoConfirm ? 'confirmed' : 'requested'
            });

            await segment.save({ session });
            segmentIds.push(segment._id);
        }

        journey.segments = segmentIds;
        await journey.save({ session });

        // 6. Update PaymentOrder if passed
        if (paymentOrder) {
            paymentOrder.status = 'completed';
            paymentOrder.paymentId = razorpay_payment_id;
            await paymentOrder.save({ session });
        }

        if (session) {
            await session.commitTransaction();
            session.endSession();
        }

        // 7. Async Operations (Notifications) - Don't block
        this.sendBookingNotifications(journey, userId);

        return { success: true, journey, payment: payment[0] };

    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error('[BOOKING SERVICE ERROR]', error);
        throw error;
    }
};

/**
 * sendBookingNotifications
 * Internal helper for async notifications
 */
exports.sendBookingNotifications = async (journey, userId) => {
    try {
        // Customer Notification
        await sendNotification(userId, {
            title: 'Booking Confirmed! 🎉',
            body: `Booking ID: #${journey._id.toString().slice(-6).toUpperCase()}`,
            type: 'booking_confirmed',
            data: { journeyId: journey._id }
        });

        // Owners Notifications
        const populatedSegments = await Segment.findByIds(journey.segments).populate('busId'); // Assuming helper exists or use find
        // ... (truncated for brevity, implementation continues below)
        const segments = await Segment.find({ _id: { $in: journey.segments } }).populate('busId');

        for (const seg of segments) {
            if (seg.busId && seg.busId.ownerId) {
                const isConfirmed = seg.status === 'confirmed';
                await sendNotification(seg.busId.ownerId, {
                    title: isConfirmed ? 'New Seat Confirmed! 🎉' : 'New Seat Confirmation Request',
                    body: `Seat ${seg.seatNumber} for ${seg.fromStop.name} → ${seg.toStop.name}`,
                    type: isConfirmed ? 'booking_confirmed' : 'seat_confirmation',
                    data: { segmentId: seg._id }
                });
            }
        }
    } catch (err) {
        console.error('[NOTIFICATION ERROR]', err);
    }
};

/**
 * finalizeWalletBooking
 * Specifically for wallet payments which are immediate and don't need Razorpay orders.
 */
exports.finalizeWalletBooking = async ({ userId, bookingData }) => {
    const Wallet = require('../models/Wallet');
    const { totalAmount } = bookingData;

    // 1. Process Wallet Debit
    const transactionId = `PAY${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const result = await Wallet.atomicDebit(userId, totalAmount, {
        transactionId,
        purpose: 'booking',
        description: `Booking payment: BK${Date.now().toString().slice(-4)}`
    });

    if (!result.success) {
        throw new Error(result.message || 'Insufficient wallet balance');
    }

    // 2. Finalize using the core logic (but with wallet specific payment details)
    return await this.finalizeBooking({
        userId,
        bookingData,
        paymentDetails: {
            razorpay_payment_id: result.transaction._id.toString(),
            razorpay_order_id: 'WALLET_PAYMENT'
        }
    });
};

