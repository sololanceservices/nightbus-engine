// ==================== models/YatraPackage.js ====================
const mongoose = require('mongoose');

const mealPlanSchema = new mongoose.Schema({
  breakfast: { type: Boolean, default: false },
  lunch: { type: Boolean, default: false },
  dinner: { type: Boolean, default: false },
  notes: String // e.g., "Prasad at temple"
}, { _id: false });

const itineraryDaySchema = new mongoose.Schema({
  day: { type: Number, required: true },        // Day 1, Day 2 ...
  title: { type: String, required: true },       // e.g., "Arrival at Haridwar"
  description: String,
  stops: [String],                               // Places visited this day
  mealPlan: mealPlanSchema,
  accommodation: String,                         // e.g., "Hotel Ram Palace, Haridwar"
  highlights: [String]                           // e.g., "Ganga Aarti", "Har Ki Pauri"
}, { _id: false });

const yatraPackageSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['religious', 'adventure', 'heritage', 'leisure'],
    default: 'religious'
  },
  highlights: [String], // Quick bullet points e.g. ["4 Dhams covered", "AC Bus", "Guide included"]

  // Dates
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },

  // Departure
  departurePoint: {
    city: { type: String, required: true },
    address: String,
    landmark: String,
    time: String // "05:00 AM"
  },
  pickupPoints: {
    type: [{
      address: { type: String, required: true },
      time: { type: String, required: true }
    }],
    default: []
  },
  destinationCity: {
    type: String,
    required: true,
    index: true
  },

  // Day-wise itinerary
  itinerary: [itineraryDaySchema],

  // What's included / excluded
  inclusions: [String],  // e.g. "AC Bus", "Breakfast & Dinner", "Guide"
  exclusions: [String],  // e.g. "Personal expenses", "Puja samagri"

  // Pricing
  pricePerPerson: {
    type: Number,
    required: true,
    min: 0
  },

  // Seat management
  totalSeats: {
    type: Number,
    required: true,
    min: 1
  },
  bookedSeats: {
    type: Number,
    default: 0
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'active', 'full', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },

  // Images
  images: [String], // URLs

  // Contact for queries
  contactPhone: String,

  // Stats
  totalRevenue: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Virtual: seats available
yatraPackageSchema.virtual('availableSeats').get(function () {
  return this.totalSeats - this.bookedSeats;
});

// Virtual: duration in days
yatraPackageSchema.virtual('durationDays').get(function () {
  if (!this.startDate || !this.endDate) return 0;
  const diff = this.endDate - this.startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
});

// Pre-save: auto-mark as full
yatraPackageSchema.pre('save', function (next) {
  if (this.bookedSeats >= this.totalSeats && this.status === 'active') {
    this.status = 'full';
  }
  next();
});

yatraPackageSchema.index({ status: 1, startDate: 1 });
yatraPackageSchema.index({ ownerId: 1, status: 1 });
yatraPackageSchema.index({ category: 1, status: 1 });

yatraPackageSchema.index({ destinationCity: 1, status: 1 });
yatraPackageSchema.index({ 'departurePoint.city': 1, destinationCity: 1 });

module.exports = mongoose.model('YatraPackage', yatraPackageSchema);
