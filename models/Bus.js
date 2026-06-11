// ==================== models/Bus.js ====================
const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chassisNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]{17}$/.test(v);
      },
      message: props => `${props.value} is not a valid 17-character alphanumeric Chassis Number!`
    }
  },
  busType: {
    type: String,
    enum: ['AC', 'Non-AC', 'Sleeper', 'Seater', 'Semi-Sleeper', 'AC Sleeper', 'AC Seater', 'Non-AC Seater'],
    default: 'Seater'
  },
  totalSeats: {
    type: Number,
    required: true
  },
  seatLayout: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
    // Example: { "1A": { row: 1, col: 1, type: "window" } }
  },
  amenities: {
    type: [String],
    enum: [
      'WiFi',
      'AC',
      'Charging Point',
      'Charging Port',
      'Water Bottle',
      'Blanket',
      'Pillow',
      'Reading Light',
      'Snacks'
    ],
    default: []
  }
  ,
  isActive: {
    type: Boolean,
    default: true
  },
  currentDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currentConductorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  seatConfiguration: [{
    seatNumber: {
      type: String,
      required: true
    },
    row: Number,
    column: Number,
    position: {
      type: String,
      enum: ['window', 'aisle', 'middle']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    registeredOn: [{
      platform: String,
      platformSeatId: String,
      registeredDate: Date,
      isActive: Boolean
    }]
  }],
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  busNumber: {
    type: String,
    uppercase: true
    // Note: Not setting unique: true here in Mongoose to avoid conflicts if the index is ghosted
    // But we should populate it from registrationNumber if missing
  },
  busName: String,
  insurancePolicyNumber: {
    type: String,
    required: [true, 'Insurance policy number is mandatory'],
    default: 'PENDING'
  },
  permitNumber: {
    type: String,
    required: [true, 'Permit number is mandatory'],
    default: 'PENDING'
  },
  fitnessNumber: {
    type: String,
    required: [true, 'Fitness certificate number is mandatory'],
    default: 'PENDING'
  },

  // GPS & Tracking
  gpsDeviceId: String,
  gpsProvider: {
    type: String,
    enum: ['internal', 'third-party', 'none'],
    default: 'none'
  },
  lastKnownLocation: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    timestamp: Date,
    speed: Number, // km/h
    heading: Number, // degrees
    accuracy: Number // meters
  },

  // Home Depot
  homeDepot: {
    name: String,
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    city: String,
    state: String,
    pincode: String
  },

  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['insurance', 'fitness_certificate', 'permit', 'pollution_certificate', 'rc_book', 'other'],
      required: true
    },
    number: String,
    issueDate: Date,
    expiryDate: Date,
    documentUrl: String,
    status: {
      type: String,
      enum: ['valid', 'expiring_soon', 'expired'],
      default: 'valid'
    },
    reminderSent: Boolean
  }],
  




  
  // Photos
  photos: [{
    url: String,
    type: {
      type: String,
      enum: ['front', 'back', 'interior', 'side', 'other']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Maintenance
  maintenanceSchedule: [{
    type: {
      type: String,
      required: true,
      enum: ['oil_change', 'tire_rotation', 'brake_check', 'general_service', 'engine_check', 'cleaning', 'ac_service', 'other']
    },
    description: String,
    dueDate: Date,
    lastDoneDate: Date,
    intervalDays: Number, // Recurring interval
    cost: Number,
    status: {
      type: String,
      enum: ['due', 'overdue', 'completed', 'scheduled'],
      default: 'scheduled'
    },
    reminderSent: Boolean
  }],

  // Current Journey
  currentJourney: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey'
  },
  currentJourneyStatus: {
    type: String,
    enum: ['idle', 'scheduled', 'running', 'maintenance', 'breakdown'],
    default: 'idle'
  },

  // Platform Integration
  externalPlatforms: [{
    platformName: String,
    isRegistered: Boolean,
    registeredDate: Date
  }],

  // Settings
  bookingSettings: {
    requiresManualApproval: {
      type: Boolean,
      default: false
    },
    autoApproveIfNoExternal: {
      type: Boolean,
      default: true
    },
    commissionPercentage: {
      type: Number,
      default: 10 // Default 10% as per requirements
    }
  },

  // Status & Condition
  status: {
    type: String,
    enum: ['available', 'in-service', 'maintenance', 'inactive', 'breakdown'],
    default: 'available'
  },
  condition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'needs_attention'],
    default: 'good'
  },
  mileage: {
    total: Number, // Total km traveled
    lastUpdated: Date
  },
  fuelType: {
    type: String,
    enum: ['diesel', 'petrol', 'cng', 'electric', 'hybrid']
  },

  // Statistics
  stats: {
    totalTrips: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalPassengers: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    lastTripDate: Date
  },

  // Real-time Status
  fuelLevel: { type: Number, default: 100 }, // Percentage
  batteryLevel: { type: Number, default: 100 }, // Percentage
  currentSpeed: { type: Number, default: 0 }, // km/h
  currentOccupancy: { type: Number, default: 0 }, // Count
  lastHeartbeat: Date,
  aiStatus: { type: String, default: 'System Normal' } // AI interpreted status
}, { timestamps: true });

busSchema.index({ ownerId: 1, isActive: 1 });
busSchema.index({ currentLocation: '2dsphere' });
busSchema.index({ busNumber: 1 }); // Ensure we have an index for the field we use for search/populate

// Pre-save hook to ensure busNumber and chassisNumber are populated
busSchema.pre('save', function(next) {
  if (!this.busNumber && this.registrationNumber) {
    this.busNumber = this.registrationNumber;
  }
  if (!this.chassisNumber && this.registrationNumber) {
    const cleanReg = this.registrationNumber.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    this.chassisNumber = `TEMPCHASSIS${cleanReg}`.padEnd(17, '0').slice(0, 17);
  }
  next();
});

// Method to generate seat configuration based on total seats
busSchema.methods.generateSeatConfiguration = function () {
  const seats = [];
  const seatsPerRow = 4; // Standard 2+2 layout
  const totalRows = Math.ceil(this.totalSeats / seatsPerRow);

  let seatNumber = 1;

  for (let row = 1; row <= totalRows; row++) {
    for (let col = 1; col <= seatsPerRow && seatNumber <= this.totalSeats; col++) {
      let position;
      if (col === 1 || col === 4) {
        position = 'window';
      } else if (col === 2 || col === 3) {
        position = 'aisle';
      }

      seats.push({
        seatNumber: seatNumber.toString(),
        row: row,
        column: col,
        position: position,
        isAvailable: true,
        registeredOn: []
      });

      seatNumber++;
    }
  }

  return seats;
};

// Check and update document statuses
busSchema.methods.updateDocumentStatuses = function () {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  this.documents.forEach(doc => {
    if (doc.expiryDate) {
      if (doc.expiryDate < now) {
        doc.status = 'expired';
      } else if (doc.expiryDate < thirtyDaysFromNow) {
        doc.status = 'expiring_soon';
      } else {
        doc.status = 'valid';
      }
    }
  });
};

// Check and update maintenance statuses
busSchema.methods.updateMaintenanceStatuses = function () {
  const now = new Date();

  this.maintenanceSchedule.forEach(maintenance => {
    if (maintenance.dueDate) {
      if (maintenance.dueDate < now && maintenance.status !== 'completed') {
        maintenance.status = 'overdue';
      } else if (maintenance.status !== 'completed') {
        maintenance.status = 'due';
      }
    }
  });
};

// Update location
busSchema.methods.updateLocation = function (locationData) {
  this.lastKnownLocation = {
    coordinates: [locationData.longitude, locationData.latitude],
    timestamp: new Date(),
    speed: locationData.speed || 0,
    heading: locationData.heading || 0,
    accuracy: locationData.accuracy || 0
  };
};

// Get expired or expiring documents
busSchema.methods.getExpiringDocuments = function () {
  return this.documents.filter(doc =>
    doc.status === 'expired' || doc.status === 'expiring_soon'
  );
};

// Get overdue or due maintenance
busSchema.methods.getDueMaintenance = function () {
  return this.maintenanceSchedule.filter(m =>
    m.status === 'overdue' || m.status === 'due'
  );
};

module.exports = mongoose.model('Bus', busSchema);