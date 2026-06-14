// ==================== models/WalletTransaction.js (PRODUCTION-READY) ====================
const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit', 'refund', 'transfer_in', 'transfer_out'],
    required: true,
    index: true
  },

  amount: {
    type: Number,
    required: true,
    min: 0,
    get: v => Math.round(v * 100) / 100,
    set: v => Math.round(v * 100) / 100
  },
  balanceBefore: {
    type: Number,
    required: true,
    get: v => Math.round(v * 100) / 100
  },
  balanceAfter: {
    type: Number,
    required: true,
    get: v => Math.round(v * 100) / 100
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Transaction identifiers
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // For credit transactions
  source: {
    type: String,
    enum: [
      'manual', 'cashfree', 'stripe', 'paytm', 'phonepe', 
      'googlepay', 'upi', 'card', 'netbanking', 
      'wallet_transfer', 'promocode', 'cashback', 'referral', 'refund',
      'money_added', 'food_booking'
    ],
    default: 'manual'
  },
  
  // For debit transactions
  purpose: {
    type: String,
    enum: [
      'booking', 'service', 'cancellation_fee', 'penalty', 'transfer', 
      'withdrawal', 'other', 'yatra_booking', 'food_booking'
    ]
  },
  
  // For refund transactions
  reason: String,
  
  // References
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    index: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  serviceBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceBooking'
  },
  
  // Payment gateway details
  gatewayTransactionId: String,
  gatewayOrderId: String,
  gatewayPaymentId: String,
  gatewayResponse: mongoose.Schema.Types.Mixed,
  
  // Description
  description: {
    type: String,
    required: true
  },
  
  // Transfer details (for P2P)
  transferDetails: {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String
  },
  
  // Failure details
  failureReason: String,
  failureCode: String,
  failedAt: Date,
  
  // Processing details
  processingStartedAt: Date,
  processingCompletedAt: Date,
  
  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  
  // IP and device info for security
  ipAddress: String,
  userAgent: String,
  deviceId: String
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Compound indexes for common queries
walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });
walletTransactionSchema.index({ bookingId: 1, type: 1 });
walletTransactionSchema.index({ status: 1, createdAt: -1 });
walletTransactionSchema.index({ createdAt: -1, type: 1 });

// Text index for search
walletTransactionSchema.index({ description: 'text', transactionId: 'text' });

// ==================== INSTANCE METHODS ====================

/**
 * Mark transaction as completed
 */
walletTransactionSchema.methods.markCompleted = async function(gatewayData = {}) {
  this.status = 'completed';
  this.processingCompletedAt = new Date();
  
  if (gatewayData.transactionId) this.gatewayTransactionId = gatewayData.transactionId;
  if (gatewayData.orderId) this.gatewayOrderId = gatewayData.orderId;
  if (gatewayData.paymentId) this.gatewayPaymentId = gatewayData.paymentId;
  if (gatewayData.response) this.gatewayResponse = gatewayData.response;
  
  await this.save();
  return this;
};

/**
 * Mark transaction as failed
 */
walletTransactionSchema.methods.markFailed = async function(reason, code) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failureCode = code;
  this.failedAt = new Date();
  await this.save();
  return this;
};

/**
 * Mark transaction as processing
 */
walletTransactionSchema.methods.markProcessing = async function() {
  this.status = 'processing';
  this.processingStartedAt = new Date();
  await this.save();
  return this;
};

// ==================== STATIC METHODS ====================

/**
 * Get user's transaction summary
 */
walletTransactionSchema.statics.getUserSummary = async function(userId, period = 'month') {
  const now = new Date();
  let startDate;
  
  switch(period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setDate(now.getDate() - 30));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      startDate = new Date(now.setDate(now.getDate() - 30));
  }
  
  const summary = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    period,
    startDate,
    credited: 0,
    debited: 0,
    refunded: 0,
    transactions: {
      credit: 0,
      debit: 0,
      refund: 0
    }
  };
  
  summary.forEach(item => {
    if (item._id === 'credit' || item._id === 'transfer_in') {
      result.credited += item.totalAmount;
      result.transactions.credit += item.count;
    } else if (item._id === 'debit' || item._id === 'transfer_out') {
      result.debited += item.totalAmount;
      result.transactions.debit += item.count;
    } else if (item._id === 'refund') {
      result.refunded += item.totalAmount;
      result.transactions.refund += item.count;
    }
  });
  
  return result;
};

/**
 * Find transaction by idempotency key
 */
walletTransactionSchema.statics.findByIdempotencyKey = async function(key) {
  return await this.findOne({ idempotencyKey: key });
};

/**
 * Get recent transactions with pagination
 */
walletTransactionSchema.statics.getRecentTransactions = async function(userId, options = {}) {
  const {
    limit = 20,
    page = 1,
    type,
    status,
    startDate,
    endDate
  } = options;
  
  const query = { userId };
  
  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const transactions = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .populate('bookingId', 'status totalAmount journeyDate')
    .lean();
  
  const total = await this.countDocuments(query);
  
  return {
    transactions,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);