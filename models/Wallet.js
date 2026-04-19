// ==================== models/Wallet.js (PRODUCTION-READY) ====================
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const WalletTransaction = require('./WalletTransaction');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
    get: v => Math.round(v * 100) / 100,
    set: v => Math.round(v * 100) / 100
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR'],
    uppercase: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  freezeReason: String,
  frozenAt: Date,

  // Transaction lock for atomic operations
  lockVersion: {
    type: Number,
    default: 0
  },

  // Lifetime statistics
  totalAdded: {
    type: Number,
    default: 0,
    get: v => Math.round(v * 100) / 100,
    set: v => Math.round(v * 100) / 100
  },
  totalSpent: {
    type: Number,
    default: 0,
    get: v => Math.round(v * 100) / 100,
    set: v => Math.round(v * 100) / 100
  },
  totalRefunded: {
    type: Number,
    default: 0,
    get: v => Math.round(v * 100) / 100,
    set: v => Math.round(v * 100) / 100
  },
  totalTransfers: {
    type: Number,
    default: 0,
    get: v => Math.round(v * 100) / 100,
    set: v => Math.round(v * 100) / 100
  },

  // Limits and restrictions
  dailyLimit: {
    type: Number,
    default: 50000 // ₹50,000 per day
  },
  monthlyLimit: {
    type: Number,
    default: 500000 // ₹5,00,000 per month
  },
  maxBalance: {
    type: Number,
    default: 200000 // ₹2,00,000 max wallet balance
  },

  // Tracking
  lastTransactionAt: Date,
  lastCreditAt: Date,
  lastDebitAt: Date,

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  collection: 'wallets',
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Compound indexes for performance
walletSchema.index({ userId: 1, isActive: 1 });
walletSchema.index({ balance: 1, isActive: 1 });
walletSchema.index({ updatedAt: -1 });
walletSchema.index({ isFrozen: 1, isActive: 1 });

// ==================== STATIC METHODS ====================

/**
 * Get or create wallet with proper error handling
 */
walletSchema.statics.getOrCreate = async function (userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    let wallet = await this.findOne({ userId, isActive: true });

    if (!wallet) {
      wallet = await this.create({
        userId,
        balance: 0,
        isActive: true,
        lockVersion: 0
      });

      console.log(`✅ New wallet created for user: ${userId}`);
    }

    return wallet;
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key - wallet exists, fetch it
      return await this.findOne({ userId, isActive: true });
    }
    throw error;
  }
};

/**
 * Atomic credit operation with optimistic locking
 */
walletSchema.statics.atomicCredit = async function (userId, amount, transactionData = {}) {
  let session = null;
  const isReplicaSet = mongoose.connection.getClient().topology?.description?.type !== 'Single';

  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    // Validate inputs
    if (!userId || !amount || amount <= 0) {
      throw new Error('Invalid credit parameters');
    }

    const safeAmount = Math.round(amount * 100) / 100;

    // Find wallet with lock
    const wallet = await this.findOne({ userId, isActive: true }).session(session);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.isFrozen) {
      throw new Error(`Wallet is frozen: ${wallet.freezeReason}`);
    }

    // Check max balance limit
    if (wallet.balance + safeAmount > wallet.maxBalance) {
      throw new Error(`Cannot exceed maximum wallet balance of ₹${wallet.maxBalance}`);
    }

    const currentVersion = wallet.lockVersion;

    // Atomic update with version check
    const updated = await this.findOneAndUpdate(
      {
        _id: wallet._id,
        lockVersion: currentVersion,
        isActive: true,
        isFrozen: false
      },
      {
        $inc: {
          balance: safeAmount,
          totalAdded: safeAmount,
          lockVersion: 1
        },
        $set: {
          lastTransactionAt: new Date(),
          lastCreditAt: new Date()
        }
      },
      {
        new: true,
        session
      }
    );

    if (!updated) {
      throw new Error('Concurrent modification detected. Please retry.');
    }

    // Create transaction record
    const transaction = await WalletTransaction.create([{
      walletId: updated._id,
      userId: updated.userId,
      type: 'credit',
      amount: safeAmount,
      balanceBefore: wallet.balance,
      balanceAfter: updated.balance,
      status: 'completed',
      transactionId: transactionData.transactionId || uuidv4(),
      source: transactionData.source || 'manual',
      description: transactionData.description || `Added ₹${safeAmount}`,
      metadata: transactionData.metadata || {}
    }], { session });

    if (session) {
      await session.commitTransaction();
    }

    return {
      success: true,
      wallet: updated,
      transaction: transaction[0]
    };

  } catch (error) {
    if (session) await session.abortTransaction();
    throw error;
  } finally {
    if (session) await session.endSession();
  }
};

/**
 * Atomic debit operation with optimistic locking
 */
walletSchema.statics.atomicDebit = async function (userId, amount, transactionData = {}) {
  let session = null;
  const isReplicaSet = mongoose.connection.getClient().topology?.description?.type !== 'Single';

  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Invalid debit parameters');
    }

    const safeAmount = Math.round(amount * 100) / 100;

    const wallet = await this.findOne({ userId, isActive: true }).session(session);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.isFrozen) {
      throw new Error(`Wallet is frozen: ${wallet.freezeReason}`);
    }

    if (wallet.balance < safeAmount) {
      throw new Error(`Insufficient balance. Required: ₹${safeAmount}, Available: ₹${wallet.balance}`);
    }

    const currentVersion = wallet.lockVersion;

    const updated = await this.findOneAndUpdate(
      {
        _id: wallet._id,
        lockVersion: currentVersion,
        balance: { $gte: safeAmount },
        isActive: true,
        isFrozen: false
      },
      {
        $inc: {
          balance: -safeAmount,
          totalSpent: safeAmount,
          lockVersion: 1
        },
        $set: {
          lastTransactionAt: new Date(),
          lastDebitAt: new Date()
        }
      },
      {
        new: true,
        session
      }
    );

    if (!updated) {
      throw new Error('Insufficient balance or concurrent modification');
    }

    const transaction = await WalletTransaction.create([{
      walletId: updated._id,
      userId: updated.userId,
      type: 'debit',
      amount: safeAmount,
      balanceBefore: wallet.balance,
      balanceAfter: updated.balance,
      status: 'completed',
      transactionId: transactionData.transactionId || uuidv4(),
      purpose: transactionData.purpose || 'booking',
      bookingId: transactionData.bookingId,
      description: transactionData.description || `Paid ₹${safeAmount}`,
      metadata: transactionData.metadata || {}
    }], { session });

    if (session) {
      await session.commitTransaction();
    }

    return {
      success: true,
      wallet: updated,
      transaction: transaction[0]
    };

  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * Atomic refund operation
 */
walletSchema.statics.atomicRefund = async function (userId, amount, transactionData = {}) {
  let session = null;
  const isReplicaSet = mongoose.connection.getClient().topology?.description?.type !== 'Single';

  if (isReplicaSet) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    if (!userId || !amount || amount <= 0) {
      throw new Error('Invalid refund parameters');
    }

    const safeAmount = Math.round(amount * 100) / 100;

    const wallet = await this.findOne({ userId, isActive: true }).session(session);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Check max balance
    if (wallet.balance + safeAmount > wallet.maxBalance) {
      throw new Error(`Refund would exceed maximum wallet balance of ₹${wallet.maxBalance}`);
    }

    const currentVersion = wallet.lockVersion;

    const updated = await this.findOneAndUpdate(
      {
        _id: wallet._id,
        lockVersion: currentVersion,
        isActive: true
      },
      {
        $inc: {
          balance: safeAmount,
          totalRefunded: safeAmount,
          lockVersion: 1
        },
        $set: {
          lastTransactionAt: new Date()
        }
      },
      {
        new: true,
        session
      }
    );

    if (!updated) {
      throw new Error('Concurrent modification detected');
    }

    const transaction = await WalletTransaction.create([{
      walletId: updated._id,
      userId: updated.userId,
      type: 'refund',
      amount: safeAmount,
      balanceBefore: wallet.balance,
      balanceAfter: updated.balance,
      status: 'completed',
      transactionId: transactionData.transactionId || uuidv4(),
      reason: transactionData.reason || 'refund',
      bookingId: transactionData.bookingId,
      description: transactionData.description || `Refund of ₹${safeAmount}`,
      metadata: transactionData.metadata || {}
    }], { session });

    if (session) {
      await session.commitTransaction();
    }

    return {
      success: true,
      wallet: updated,
      transaction: transaction[0]
    };

  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * Freeze/Unfreeze wallet
 */
walletSchema.methods.freeze = async function (reason) {
  this.isFrozen = true;
  this.freezeReason = reason;
  this.frozenAt = new Date();
  await this.save();
  return this;
};

walletSchema.methods.unfreeze = async function () {
  this.isFrozen = false;
  this.freezeReason = null;
  this.frozenAt = null;
  await this.save();
  return this;
};

/**
 * Check daily/monthly limits
 */
walletSchema.statics.checkLimits = async function (userId, amount, period = 'daily') {
  const now = new Date();
  let startDate;

  if (period === 'daily') {
    startDate = new Date(now.setHours(0, 0, 0, 0));
  } else if (period === 'monthly') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const totalSpent = await WalletTransaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'credit',
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  const spent = totalSpent.length > 0 ? totalSpent[0].total : 0;
  const wallet = await this.findOne({ userId });
  const limit = period === 'daily' ? wallet.dailyLimit : wallet.monthlyLimit;

  return {
    canProceed: (spent + amount) <= limit,
    spent,
    limit,
    remaining: limit - spent,
    period
  };
};

module.exports = mongoose.model('Wallet', walletSchema);