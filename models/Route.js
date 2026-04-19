// ==================== models/Route.js (ENHANCED - PRODUCTION READY) ====================
const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  nameHindi: String, // Hindi/local language name
  aliases: [String], // Alternative names, nicknames
  village: String, // If it's a small village
  district: String,
  state: String,
  landmark: String, // Famous landmark nearby
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  sequence: {
    type: Number,
    required: true
  },
  arrivalTime: String, // "06:00"
  departureTime: String, // "06:10"
  stopDuration: {
    type: Number,
    default: 10 // minutes
  },
  isPrimaryStop: {
    type: Boolean,
    default: false // Main stops vs. flag stops
  },
  stopType: {
    type: String,
    enum: ['major', 'minor', 'village', 'flag', 'custom'],
    default: 'major'
  },
  isCustomManual: {
    type: Boolean,
    default: false
  },
  facilities: [String], // ["toilet", "food", "water"]
  geofenceRadius: {
    type: Number,
    default: 200 // meters
  }
}, { _id: false });

const routeSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
    index: true
  },
  routeName: {
    type: String,
    required: true
  },
  routeCode: {
    type: String,
    unique: true,
    uppercase: true
  },
  // Exact path coordinates for high-resolution map display
  pathCoordinates: [{
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  }],
  // Stop management
  stops: [stopSchema],
  fromLocation: {
    name: String,
    village: String,
    district: String
  },
  toLocation: {
    name: String,
    village: String,
    district: String
  },
  totalDistance: {
    type: Number, // in kilometers
    required: true
  },
  estimatedDuration: {
    type: Number, // in minutes
    required: true
  },
  // Pricing
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerKm: {
    type: Number,
    default: 2,
    min: 0
  },
  // Dynamic pricing by stop pairs
  customPricing: [{
    fromStop: String,
    toStop: String,
    price: Number
  }],
  // Schedule
  days: [{
    type: String,
    enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  }],
  scheduleType: {
    type: String,
    enum: ['daily', 'specific-days', 'on-demand'],
    default: 'specific-days'
  },
  departureTime: String, // Default departure time
  // External platform registrations
  externalPlatforms: [{
    platform: {
      type: String,
      enum: ['redbus', 'abhibus', 'makemytrip', 'goibibo', 'paytm', 'other'],
      required: true
    },
    isRegistered: {
      type: Boolean,
      default: false
    },
    platformRouteId: String,
    registrationDate: Date,
    notes: String
  }],
  // Round management (Multi-scheduling)
  rounds: [{
    startTime: { type: String, required: true }, // e.g., "08:00"
    roundLabel: String, // e.g., "Morning Trip"
    isActive: { type: Boolean, default: true }
  }],
  // Approval settings
  requiresManualApproval: {
    type: Boolean,
    default: true // Default to manual approval for safety
  },
  autoApproveIfNoExternal: {
    type: Boolean,
    default: true // Auto-approve if not registered on other platforms
  },
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active'
  },
  // Validity
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: Date,
  // Statistics
  totalBookings: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  averageOccupancy: {
    type: Number,
    default: 0
  },
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
routeSchema.index({ ownerId: 1, isActive: 1 });
routeSchema.index({ busId: 1, isActive: 1 });
routeSchema.index({ routeCode: 1 });
routeSchema.index({ 'stops.name': 'text', 'stops.village': 'text', routeName: 'text' });
routeSchema.index({ days: 1, isActive: 1 });

// Virtuals
routeSchema.virtual('hasExternalRegistrations').get(function () {
  return this.externalPlatforms && this.externalPlatforms.some(p => p.isRegistered);
});

routeSchema.virtual('registeredPlatforms').get(function () {
  if (!this.externalPlatforms) return [];
  return this.externalPlatforms
    .filter(p => p.isRegistered)
    .map(p => p.platform);
});

// Pre-save middleware
routeSchema.pre('save', function (next) {
  // Generate route code if not exists
  if (!this.routeCode) {
    const from = this.stops[0]?.name.substring(0, 3).toUpperCase();
    const to = this.stops[this.stops.length - 1]?.name.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.routeCode = `${from}${to}${random}`;
  }

  // Migrate single departureTime to rounds if rounds array is empty
  if ((!this.rounds || this.rounds.length === 0) && this.departureTime) {
    this.rounds = [{
      startTime: this.departureTime,
      roundLabel: 'Standard Round',
      isActive: true
    }];
  }

  // Set from/to locations
  if (this.stops && this.stops.length >= 2) {
    const firstStop = this.stops[0];
    const lastStop = this.stops[this.stops.length - 1];

    this.fromLocation = {
      name: firstStop.name,
      village: firstStop.village,
      district: firstStop.district
    };

    this.toLocation = {
      name: lastStop.name,
      village: lastStop.village,
      district: lastStop.district
    };
  }

  next();
});

// Instance Methods
routeSchema.methods.calculatePrice = function (fromStop, toStop) {
  // Check custom pricing first
  const customPrice = this.customPricing?.find(
    p => p.fromStop === fromStop && p.toStop === toStop
  );

  if (customPrice) {
    return customPrice.price;
  }

  // Calculate based on distance between stops
  const fromIndex = this.stops.findIndex(s => s.name === fromStop);
  const toIndex = this.stops.findIndex(s => s.name === toStop);

  if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
    return this.basePrice;
  }

  // Simplified distance calculation (you can enhance this)
  const distance = Math.abs(toIndex - fromIndex) * 10; // Assume 10km per stop
  return Math.round(this.basePrice + (distance * this.pricePerKm));
};

routeSchema.methods.isOperatingToday = function () {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
  return this.days.includes(today);
};

routeSchema.methods.needsManualApproval = function () {
  if (!this.requiresManualApproval) return false;
  if (this.hasExternalRegistrations) return true;
  return !this.autoApproveIfNoExternal;
};

// Static Methods
routeSchema.statics.findActiveRoutes = function (ownerId) {
  return this.find({
    ownerId,
    isActive: true,
    status: 'active'
  }).populate('busId').sort('-createdAt');
};

routeSchema.statics.searchRoutes = async function (from, to) {
  return this.find({
    isActive: true,
    status: 'active',
    $or: [
      { 'stops.name': new RegExp(from, 'i') },
      { 'stops.village': new RegExp(from, 'i') }
    ]
  }).find({
    $or: [
      { 'stops.name': new RegExp(to, 'i') },
      { 'stops.village': new RegExp(to, 'i') }
    ]
  }).populate('busId ownerId');
};

module.exports = mongoose.model('Route', routeSchema);