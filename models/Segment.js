const mongoose = require('mongoose');
const { sendNotification } = require('../utils/notifications');

const segmentSchema = new mongoose.Schema({
  // Journey & Route Info
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    required: true,
    index: true
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true,
    index: true
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Travel Details
  fromStop: {
    name: { type: String, required: true },
    village: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  toStop: {
    name: { type: String, required: true },
    village: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  seatNumber: {
    type: String,
    required: true,
    index: true
  },
  seatGender: {
    type: String,
    enum: ['male', 'female', 'any'],
    default: 'any'
  },
  // Passenger Details (Who is actually sitting)
  passengerDetails: {
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    phone: String // Optional, if different from customer
  },
  travelDate: {
    type: Date,
    required: true,
    index: true
  },
  departureTime: String, // "06:00"
  estimatedArrivalTime: String, // "10:30"
  roundStartTime: {
    type: String,
    index: true // Important for filtering bookings per round
  },
  // Pricing
  price: {
    type: Number,
    required: true,
    min: 0
  },
  platformFee: {
    type: Number,
    default: 0
  },
  platformCommission: {
    type: Number,
    default: 0
  },
  ownerEarnings: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  // Booking Status & Workflow
  status: {
    type: String,
    enum: [
      'requested',      // Initial booking request
      'pending_approval', // Waiting for owner approval
      'confirmed',      // Owner approved
      'rejected',       // Owner rejected
      'boarded',        // Passenger has boarded
      'in_transit',     // Bus is en-route
      'completed',      // Journey completed
      'cancelled',      // Booking cancelled
      'refunded'        // Payment refunded
    ],
    default: 'requested',
    index: true
  },
  // Approval System
  requiresManualApproval: {
    type: Boolean,
    default: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'auto_approved', 'manually_approved', 'rejected', 'not_required'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Owner or authorized staff
  },
  approvedAt: Date,
  rejectionReason: String,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  // Boarding Process
  boardingOTP: {
    code: String,
    generatedAt: Date,
    expiresAt: Date,
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: Date
  },
  boardedAt: Date,
  boardedBy: {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    staffName: String,
    staffRole: String,
    method: {
      type: String,
      enum: ['qr_scan', 'otp', 'manual'],
      default: 'qr_scan'
    }
  },
  boardingLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number] // [longitude, latitude]
  },
  // QR Code
  qrCodeData: String, // Encrypted QR code data
  qrCodeScanned: {
    type: Boolean,
    default: false
  },
  qrCodeScanCount: {
    type: Number,
    default: 0
  },
  lastQRScanAt: Date,
  // Exit/Completion Process
  exitOTP: {
    code: String,
    generatedAt: Date,
    expiresAt: Date,
    isUsed: {
      type: Boolean,
      default: false
    },
    usedAt: Date,
    sentViaSMS: {
      type: Boolean,
      default: false
    },
    sentViaApp: {
      type: Boolean,
      default: false
    }
  },
  completedAt: Date,
  exitVerifiedBy: {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    staffName: String,
    method: {
      type: String,
      enum: ['otp', 'manual', 'auto'],
      default: 'otp'
    }
  },
  exitLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: [Number]
  },
  actualArrivalTime: String,
  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['wallet', 'upi', 'card', 'cash', 'netbanking'],
    default: 'wallet'
  },
  transactionId: String,
  refundAmount: Number,
  refundedAt: Date,
  // Platform Tracking
  bookedVia: {
    type: String,
    enum: ['app', 'web', 'counter', 'phone'],
    default: 'app'
  },
  isPlatformConflict: {
    type: Boolean,
    default: false // True if seat was potentially booked on external platform
  },
  conflictPlatforms: [String], // e.g., ['redbus', 'abhibus']
  // Rating & Feedback
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: String,
  feedbackAt: Date,
  // Notifications
  notificationsSent: [{
    type: {
      type: String,
      enum: ['booking_confirmed', 'boarding_reminder', 'otp', 'journey_started', 'journey_completed']
    },
    sentAt: Date,
    channel: {
      type: String,
      enum: ['sms', 'app', 'email']
    }
  }],
  // Metadata
  notes: String, // Staff notes
  specialRequests: String, // Customer special requests
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
segmentSchema.index({ journeyId: 1, status: 1 });
segmentSchema.index({ busId: 1, travelDate: 1, status: 1 });
segmentSchema.index({ routeId: 1, travelDate: 1, roundStartTime: 1 });
segmentSchema.index({ customerId: 1, status: 1 });
segmentSchema.index({ seatNumber: 1, busId: 1, travelDate: 1, roundStartTime: 1 });
segmentSchema.index({ status: 1, travelDate: 1 });
segmentSchema.index({ 'boardedBy.staffId': 1 });

// Virtuals
segmentSchema.virtual('segmentCode').get(function () {
  return `SEG${this._id.toString().slice(-8).toUpperCase()}`;
});

segmentSchema.virtual('duration').get(function () {
  if (!this.departureTime || !this.estimatedArrivalTime) return null;

  const depParts = this.departureTime.split(':');
  const arrParts = this.estimatedArrivalTime.split(':');

  const depMinutes = parseInt(depParts[0]) * 60 + parseInt(depParts[1]);
  const arrMinutes = parseInt(arrParts[0]) * 60 + parseInt(arrParts[1]);

  return arrMinutes - depMinutes;
});

// Pre-save middleware
segmentSchema.pre('save', async function (next) {
  // Auto-generate boarding OTP when status changes to confirmed
  if (this.isModified('status') && this.status === 'confirmed' && !this.boardingOTP?.code) {
    await this.generateBoardingOTP(false);
  }

  // Calculate total amount, commission and earnings
  if (this.isModified('price') || this.isModified('platformFee') || this.isModified('platformCommission')) {
    this.totalAmount = this.price + (this.platformFee || 0);

    // If commission is not set manually, it will be handled by the controller
    // or we can set a fallback here if needed, but controller is better as it has access to bus settings.
    this.ownerEarnings = this.totalAmount - (this.platformCommission || 0);
  }

  next();
});

// Instance Methods

// Generate 6-digit boarding OTP
segmentSchema.methods.generateBoardingOTP = async function (allowSave = true) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  this.boardingOTP = {
    code,
    generatedAt: new Date(),
    expiresAt,
    isUsed: false
  };

  if (allowSave) {
    await this.save();
  }

  // Send notification
  try {
    await sendNotification(this.customerId, {
      title: 'Boarding OTP Generated',
      body: `Your boarding OTP is ${code}. Valid for 24 hours.`,
      type: 'booking_confirmed',
      data: {
        segmentId: this._id,
        screen: 'BookingDetails',
        params: { segmentId: this._id }
      }
    });
  } catch (error) {
    console.error('Notification failed:', error);
  }

  return code;
};

// Verify boarding OTP
segmentSchema.methods.verifyBoardingOTP = function (otp) {
  if (!this.boardingOTP || !this.boardingOTP.code) {
    return { success: false, message: 'No OTP generated' };
  }

  if (this.boardingOTP.isUsed) {
    return { success: false, message: 'OTP already used' };
  }

  if (new Date() > new Date(this.boardingOTP.expiresAt)) {
    return { success: false, message: 'OTP expired' };
  }

  if (this.boardingOTP.code !== otp.toString()) {
    return { success: false, message: 'Invalid OTP' };
  }

  return { success: true };
};

// Mark as boarded
segmentSchema.methods.markBoarded = async function (staffData) {
  this.status = 'boarded';
  this.boardedAt = new Date();
  this.boardedBy = {
    staffId: staffData.staffId,
    staffName: staffData.staffName,
    staffRole: staffData.staffRole,
    method: staffData.method || 'qr_scan'
  };

  if (staffData.location) {
    this.boardingLocation = {
      type: 'Point',
      coordinates: [staffData.location.longitude, staffData.location.latitude]
    };
  }

  if (this.boardingOTP) {
    this.boardingOTP.isUsed = true;
    this.boardingOTP.usedAt = new Date();
  }

  this.qrCodeScanned = true;
  this.qrCodeScanCount += 1;
  this.lastQRScanAt = new Date();

  await this.save();

  // Notify customer
  await sendNotification(this.customerId, {
    title: 'Boarding Confirmed',
    body: `You have successfully boarded. Have a safe journey!`,
    type: 'passenger_boarded',
    data: {
      segmentId: this._id
    }
  }).catch(err => console.log('Notification error:', err));

  return this;
};

// Generate exit OTP
segmentSchema.methods.generateExitOTP = async function (sendViaSMS = false) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  this.exitOTP = {
    code,
    generatedAt: new Date(),
    expiresAt,
    isUsed: false,
    sentViaSMS: sendViaSMS,
    sentViaApp: true
  };

  await this.save();

  // Send notification
  await sendNotification(this.customerId, {
    title: 'Exit OTP',
    body: `Your exit OTP is ${code}. Show this to the conductor when alighting.`,
    type: 'system_alert',
    data: {
      segmentId: this._id
    }
  }).catch(err => console.log('Notification error:', err));

  return code;
};

// Verify exit OTP and mark completed
segmentSchema.methods.verifyExitOTP = async function (otp, staffData) {
  if (!this.exitOTP || !this.exitOTP.code) {
    return { success: false, message: 'No exit OTP generated' };
  }

  if (this.exitOTP.isUsed) {
    return { success: false, message: 'OTP already used' };
  }

  if (new Date() > new Date(this.exitOTP.expiresAt)) {
    return { success: false, message: 'OTP expired. Please generate a new one.' };
  }

  if (this.exitOTP.code !== otp.toString()) {
    return { success: false, message: 'Invalid OTP' };
  }

  // Mark as completed
  this.status = 'completed';
  this.completedAt = new Date();
  this.exitOTP.isUsed = true;
  this.exitOTP.usedAt = new Date();

  this.exitVerifiedBy = {
    staffId: staffData.staffId,
    staffName: staffData.staffName,
    method: 'otp'
  };

  if (staffData.location) {
    this.exitLocation = {
      type: 'Point',
      coordinates: [staffData.location.longitude, staffData.location.latitude]
    };
  }

  this.actualArrivalTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  await this.save();

  return { success: true, message: 'Journey completed successfully' };
};

// Check if can be boarded
segmentSchema.methods.canBeBoarded = function () {
  if (this.status !== 'confirmed') {
    return { allowed: false, reason: `Booking is ${this.status}, not confirmed` };
  }

  const now = new Date();
  const travelDate = new Date(this.travelDate);

  // Check if travel date is today
  if (travelDate.toDateString() !== now.toDateString()) {
    return { allowed: false, reason: 'Boarding only allowed on travel date' };
  }

  if (this.boardedAt) {
    return { allowed: false, reason: 'Already boarded' };
  }

  return { allowed: true };
};

// Approve segment (for manual approval)
segmentSchema.methods.approve = async function (approvedBy) {
  this.status = 'confirmed';
  this.approvalStatus = 'manually_approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();

  await this.save();

  // Generate boarding OTP
  await this.generateBoardingOTP();

  // Notify customer
  await sendNotification(this.customerId, {
    title: 'Booking Confirmed!',
    body: `Your seat ${this.seatNumber} has been confirmed for ${this.fromStop.name} to ${this.toStop.name}`,
    type: 'booking_confirmed',
    data: {
      segmentId: this._id,
      screen: 'BookingDetails'
    }
  }).catch(err => console.log('Notification error:', err));

  return this;
};

// Reject segment
segmentSchema.methods.reject = async function (rejectedBy, reason) {
  this.status = 'rejected';
  this.approvalStatus = 'rejected';
  this.rejectedBy = rejectedBy;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;

  await this.save();

  // Notify customer
  await sendNotification(this.customerId, {
    title: 'Booking Rejected',
    body: `Sorry, your seat ${this.seatNumber} booking was rejected. Reason: ${reason}`,
    type: 'booking_rejected',
    data: {
      segmentId: this._id
    }
  }).catch(err => console.log('Notification error:', err));

  return this;
};

// Static Methods

// Get booked seats for a bus on a date
segmentSchema.statics.getBookedSeats = async function (busId, travelDate, roundStartTime, status = ['confirmed', 'boarded', 'requested', 'pending_approval']) {
  const dateObj = new Date(travelDate);
  dateObj.setHours(0, 0, 0, 0);
  const nextDay = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000);

  const query = {
    busId,
    travelDate: { $gte: dateObj, $lt: nextDay },
    status: { $in: status }
  };

  if (roundStartTime) {
    query.roundStartTime = roundStartTime;
  }

  const segments = await this.find(query).select('seatNumber status');

  return segments.map(s => ({
    seatNumber: s.seatNumber,
    status: s.status
  }));
};

// Check seat availability
segmentSchema.statics.isSeatAvailable = async function (busId, seatNumber, travelDate, roundStartTime) {
  const dateObj = new Date(travelDate);
  dateObj.setHours(0, 0, 0, 0);
  const nextDay = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000);

  const query = {
    busId,
    seatNumber,
    travelDate: { $gte: dateObj, $lt: nextDay },
    status: { $in: ['confirmed', 'boarded', 'requested', 'pending_approval'] }
  };

  if (roundStartTime) {
    query.roundStartTime = roundStartTime;
  }

  const existing = await this.findOne(query);

  return !existing;
};

// Get pending approvals for owner
segmentSchema.statics.getPendingApprovals = async function (ownerId) {
  const Bus = mongoose.model('Bus');
  const buses = await Bus.find({ ownerId }, '_id');
  const busIds = buses.map(b => b._id);

  return await this.find({
    busId: { $in: busIds },
    status: { $in: ['requested', 'pending_approval'] },
    approvalStatus: 'pending'
  })
    .populate('customerId', 'name phone')
    .populate('busId', 'chassisNumber busType')
    .populate('routeId', 'routeName')
    .sort('-createdAt');
};

module.exports = mongoose.model('Segment', segmentSchema);