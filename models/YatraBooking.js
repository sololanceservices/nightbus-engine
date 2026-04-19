// ==================== models/YatraBooking.js ====================
const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  idProofType: {
    type: String,
    enum: ['aadhar', 'pan', 'passport', 'voter_id', 'driving_license'],
    default: 'aadhar'
  },
  idProofNumber: String
}, { _id: false });

const yatraBookingSchema = new mongoose.Schema({
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'YatraPackage',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Passengers on this booking
  passengers: {
    type: [passengerSchema],
    validate: {
      validator: function (v) { return v.length >= 1; },
      message: 'At least 1 passenger required'
    }
  },

  seatsBooked: {
    type: Number,
    required: true,
    min: 1
  },

  // Pricing snapshot (at time of booking)
  pricePerPerson: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },

  // Preferences
  mealPreference: {
    type: String,
    enum: ['veg', 'non-veg', 'jain'],
    default: 'veg'
  },
  specialRequests: String,

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'confirmed', // Auto-confirmed after payment
    index: true
  },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  transactionId: String,

  // Cancellation
  cancellationDate: Date,
  cancellationReason: String,
  refundAmount: {
    type: Number,
    default: 0
  },

  // Boarding OTP for the Yatra departure
  boardingOtp: {
    type: String,
    length: 6
  }
}, { timestamps: true });

// Virtual: booking reference
yatraBookingSchema.virtual('bookingRef').get(function () {
  return `YTR${this._id.toString().slice(-6).toUpperCase()}`;
});

yatraBookingSchema.index({ customerId: 1, status: 1 });
yatraBookingSchema.index({ packageId: 1, status: 1 });

module.exports = mongoose.model('YatraBooking', yatraBookingSchema);
