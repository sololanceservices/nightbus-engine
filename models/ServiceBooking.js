// ==================== models/ServiceBooking.js ====================
const mongoose = require('mongoose');

const serviceBookingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceListing',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingDate: {
    type: Date,
    required: true
  },
  timeSlot: {
    startTime: String,
    endTime: String
  },
  duration: Number, // in hours
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'rejected', 'confirmed', 'in-progress', 'completed', 'cancelled', 'refunded'],
    default: 'requested'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'held', 'released', 'refunded'],
    default: 'pending'
  },
  escrowReleased: {
    type: Boolean,
    default: false
  },
  specialNotes: String,
  cancellationReason: String,
  rejectionReason: String
}, { timestamps: true });

serviceBookingSchema.index({ customerId: 1, status: 1 });
serviceBookingSchema.index({ providerId: 1, status: 1 });
serviceBookingSchema.index({ serviceId: 1, bookingDate: 1 });

module.exports = mongoose.model('ServiceBooking', serviceBookingSchema);
