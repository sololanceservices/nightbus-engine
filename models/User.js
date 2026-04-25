// ==================== models/User.js ====================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    select: false // Don't include in default queries
  },
  age: Number,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true // Allow null/missing emails to still be unique
  },
  role: {
    type: String,
    enum: ['customer', 'owner', 'staff', 'vendor', 'admin'],
    default: 'customer'
  },
  // Sub-roles for Admin (Super, Finance, Logistics, etc)
  adminRole: {
    type: String,
    enum: ['super', 'finance', 'logistics', 'marketplace', 'support']
  },
  adminPermissions: [String], // Array of permission keys
  language: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  },
  fcmToken: String, // Single token (legacy/simplicity)
  fcmTokens: [String], // Array for multiple devices
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  kycDetails: {
    document: String,
    documentNumber: String,
    isVerified: Boolean
  },
  companyProfile: {
    companyName: String,
    gstin: String,
    address: String
  },
  ownerSettings: {
    autoConfirmBookings: {
      type: Boolean,
      default: false
    }
  },
  isServiceProvider: {
    type: Boolean,
    default: false
  },
  serviceType: String, // Tracks the type if they are a provider (e.g. 'Driver')
  isFoodVendor: {
    type: Boolean,
    default: false
  },
  // Staff Specific Fields
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  staffRole: {
    type: String,
    enum: ['driver', 'conductor', 'helper', 'cleaner', 'other']
  },
  assignedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus'
  },
  permissions: {
    type: Map,
    of: Boolean,
    default: {
      'verify_ticket': true,
      'update_location': true,
      'manage_boarding': true,
      'op_controls': false,
      'view_manifest': true
    }
  }
}, { timestamps: true });

userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Password verification method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);