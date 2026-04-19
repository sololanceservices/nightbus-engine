// ==================== controllers/walletController.js (PRODUCTION-READY) ====================
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const { v4: uuidv4 } = require('uuid');
const { sendNotification } = require('../utils/notifications');
const { validateAmount, sanitizeInput } = require('../utils/validators');
const rateLimit = require('express-rate-limit');

// ==================== RATE LIMITERS ====================
const addMoneyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many add money requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const transferLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many transfer requests, please try again later'
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique transaction ID
 */
const generateTransactionId = (prefix = 'TXN') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Validate transaction amount
 */
const validateTransactionAmount = (amount, min = 1, max = 50000) => {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('Invalid amount');
  }
  
  if (numAmount < min) {
    throw new Error(`Minimum amount is ₹${min}`);
  }
  
  if (numAmount > max) {
    throw new Error(`Maximum amount is ₹${max}`);
  }
  
  return Math.round(numAmount * 100) / 100;
};

/**
 * Get client info for security tracking
 */
const getClientInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    deviceId: req.get('x-device-id') || 'unknown'
  };
};

// ==================== CONTROLLERS ====================

/**
 * @desc    Get user's wallet details
 * @route   GET /api/wallet
 * @access  Private
 */
exports.getWallet = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User ID not found'
      });
    }

    const wallet = await Wallet.getOrCreate(userId);

    // Get recent activity summary
    const summary = await WalletTransaction.getUserSummary(userId, 'month');

    res.json({
      success: true,
      data: {
        wallet: {
          id: wallet._id,
          balance: wallet.balance,
          currency: wallet.currency,
          totalAdded: wallet.totalAdded,
          totalSpent: wallet.totalSpent,
          totalRefunded: wallet.totalRefunded,
          isActive: wallet.isActive,
          isFrozen: wallet.isFrozen,
          lastTransactionAt: wallet.lastTransactionAt,
          limits: {
            daily: wallet.dailyLimit,
            monthly: wallet.monthlyLimit,
            maxBalance: wallet.maxBalance
          }
        },
        summary
      }
    });

  } catch (error) {
    console.error('❌ [GET WALLET ERROR]', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch wallet details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get wallet transaction history
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const options = {
      limit: parseInt(req.query.limit) || 20,
      page: parseInt(req.query.page) || 1,
      type: req.query.type,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    // Validate limits
    if (options.limit > 100) options.limit = 100;
    if (options.page < 1) options.page = 1;

    const result = await WalletTransaction.getRecentTransactions(userId, options);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [GET TRANSACTIONS ERROR]', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Add money to wallet
 * @route   POST /api/wallet/add-money
 * @access  Private
 */
exports.addMoney = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let { amount, source = 'manual', paymentMethod = 'test', idempotencyKey } = req.body;

    // Validate amount
    try {
      amount = validateTransactionAmount(amount, 10, 50000);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await WalletTransaction.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.json({
          success: true,
          message: 'Transaction already processed',
          data: {
            wallet: await Wallet.findOne({ userId }),
            transaction: existing
          }
        });
      }
    }

    // Check daily limit
    const limitCheck = await Wallet.checkLimits(userId, amount, 'daily');
    if (!limitCheck.canProceed) {
      return res.status(400).json({
        success: false,
        message: `Daily limit exceeded. You can add ₹${limitCheck.remaining.toFixed(2)} more today`,
        data: limitCheck
      });
    }

    // Generate transaction ID
    const transactionId = generateTransactionId('ADD');
    const clientInfo = getClientInfo(req);

    // Perform atomic credit
    const result = await Wallet.atomicCredit(userId, amount, {
      transactionId,
      source,
      description: `Added ₹${amount} to wallet via ${paymentMethod}`,
      idempotencyKey,
      metadata: {
        paymentMethod,
        ...clientInfo
      }
    });

    // Send notification (non-blocking)
    sendNotification(userId, {
      title: '💰 Money Added',
      body: `₹${amount} has been added to your wallet`,
      type: 'wallet_credit',
      data: { 
        amount, 
        balance: result.wallet.balance,
        transactionId 
      }
    }).catch(err => console.warn('⚠️ Notification failed:', err.message));

    res.json({
      success: true,
      message: `₹${amount} added successfully`,
      data: {
        balance: result.wallet.balance,
        transactionId: result.transaction.transactionId,
        transaction: result.transaction
      }
    });

  } catch (error) {
    console.error('❌ [ADD MONEY ERROR]', error);
    
    let statusCode = 500;
    let message = 'Failed to add money';
    
    if (error.message.includes('limit')) statusCode = 400;
    if (error.message.includes('frozen')) statusCode = 403;
    
    res.status(statusCode).json({ 
      success: false, 
      message: error.message || message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * @desc    Deduct money from wallet (Internal use by booking system)
 * @route   Internal function
 * @access  Internal
 */
exports.deductMoney = async (userId, amount, bookingData = {}) => {
  try {
    const transactionId = generateTransactionId('PAY');
    
    const result = await Wallet.atomicDebit(userId, amount, {
      transactionId,
      purpose: bookingData.purpose || 'booking',
      bookingId: bookingData.bookingId,
      description: bookingData.description || `Payment for booking`,
      metadata: bookingData.metadata || {}
    });

    // Send notification
    sendNotification(userId, {
      title: '💸 Payment Successful',
      body: `₹${amount} debited from your wallet`,
      type: 'wallet_debit',
      data: {
        amount,
        balance: result.wallet.balance,
        bookingId: bookingData.bookingId
      }
    }).catch(err => console.warn('⚠️ Notification failed:', err.message));

    return {
      success: true,
      balance: result.wallet.balance,
      transactionId: result.transaction.transactionId,
      transaction: result.transaction
    };

  } catch (error) {
    console.error('❌ [DEDUCT MONEY ERROR]', error);
    throw error;
  }
};

/**
 * @desc    Refund money to wallet
 * @route   POST /api/wallet/refund
 * @access  Private/Admin
 */
exports.refundToWallet = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let { amount, bookingId, reason, idempotencyKey } = req.body;

    // Validate
    try {
      amount = validateTransactionAmount(amount, 1, 100000);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Refund reason is required'
      });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await WalletTransaction.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.json({
          success: true,
          message: 'Refund already processed',
          data: {
            wallet: await Wallet.findOne({ userId }),
            transaction: existing
          }
        });
      }
    }

    const transactionId = generateTransactionId('RFD');
    const clientInfo = getClientInfo(req);

    const result = await Wallet.atomicRefund(userId, amount, {
      transactionId,
      reason,
      bookingId,
      description: `Refund: ${reason}`,
      idempotencyKey,
      metadata: {
        refundedBy: req.userRole,
        ...clientInfo
      }
    });

    // Send notification
    sendNotification(userId, {
      title: '💚 Refund Processed',
      body: `₹${amount} has been refunded to your wallet`,
      type: 'wallet_refund',
      data: { 
        amount, 
        balance: result.wallet.balance,
        reason 
      }
    }).catch(err => console.warn('⚠️ Notification failed:', err.message));

    res.json({
      success: true,
      message: `₹${amount} refunded successfully`,
      data: {
        balance: result.wallet.balance,
        transactionId: result.transaction.transactionId,
        transaction: result.transaction
      }
    });

  } catch (error) {
    console.error('❌ [REFUND ERROR]', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process refund'
    });
  }
};

/**
 * @desc    Check wallet balance
 * @route   GET /api/wallet/check-balance
 * @access  Private
 */
exports.checkBalance = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { requiredAmount } = req.query;
    const wallet = await Wallet.getOrCreate(userId);

    const required = parseFloat(requiredAmount) || 0;
    const hasSufficientBalance = wallet.balance >= required;

    res.json({
      success: true,
      data: {
        balance: wallet.balance,
        required: required,
        hasSufficientBalance,
        shortfall: hasSufficientBalance ? 0 : required - wallet.balance,
        currency: wallet.currency
      }
    });

  } catch (error) {
    console.error('❌ [BALANCE CHECK ERROR]', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check balance'
    });
  }
};

/**
 * @desc    Transfer money to another user
 * @route   POST /api/wallet/transfer
 * @access  Private
 */
exports.transferMoney = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    let { recipientUserId, amount, note, idempotencyKey } = req.body;

    // Validate
    if (!recipientUserId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient user ID is required'
      });
    }

    if (userId.toString() === recipientUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer to yourself'
      });
    }

    try {
      amount = validateTransactionAmount(amount, 10, 10000);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await WalletTransaction.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return res.json({
          success: true,
          message: 'Transfer already processed',
          data: {
            wallet: await Wallet.findOne({ userId }),
            transaction: existing
          }
        });
      }
    }

    const transactionId = generateTransactionId('TRF');
    const clientInfo = getClientInfo(req);

    // Deduct from sender
    const debitResult = await Wallet.atomicDebit(userId, amount, {
      transactionId: `${transactionId}_OUT`,
      purpose: 'transfer',
      description: `Transfer to user`,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}_debit` : undefined,
      metadata: {
        recipientUserId,
        note,
        ...clientInfo
      }
    });

    // Credit to recipient
    try {
      const creditResult = await Wallet.atomicCredit(recipientUserId, amount, {
        transactionId: `${transactionId}_IN`,
        source: 'wallet_transfer',
        description: `Transfer from user`,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}_credit` : undefined,
        metadata: {
          senderUserId: userId,
          note,
          ...clientInfo
        }
      });

      // Send notifications
      sendNotification(userId, {
        title: '📤 Money Sent',
        body: `₹${amount} transferred successfully`,
        type: 'wallet_transfer_sent'
      }).catch(err => console.warn('⚠️ Notification failed'));

      sendNotification(recipientUserId, {
        title: '📥 Money Received',
        body: `₹${amount} received in your wallet`,
        type: 'wallet_transfer_received'
      }).catch(err => console.warn('⚠️ Notification failed'));

      res.json({
        success: true,
        message: `₹${amount} transferred successfully`,
        data: {
          balance: debitResult.wallet.balance,
          transactionId,
          debitTransaction: debitResult.transaction,
          creditTransaction: creditResult.transaction
        }
      });

    } catch (creditError) {
      // If credit fails, we need to refund the sender
      console.error('❌ Credit failed, refunding sender:', creditError);
      
      await Wallet.atomicRefund(userId, amount, {
        transactionId: `${transactionId}_REFUND`,
        reason: 'Transfer failed - automatic refund',
        description: `Refund: Transfer to ${recipientUserId} failed`
      });

      throw new Error('Transfer failed: Could not credit recipient. Amount has been refunded.');
    }

  } catch (error) {
    console.error('❌ [TRANSFER ERROR]', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to transfer money'
    });
  }
};

/**
 * @desc    Get wallet statistics
 * @route   GET /api/wallet/stats
 * @access  Private
 */
exports.getWalletStats = async (req, res) => {
  try {
    const userId = req.userId;
    const period = req.query.period || 'month';
    
    const summary = await WalletTransaction.getUserSummary(userId, period);
    const wallet = await Wallet.findOne({ userId });
    
    res.json({
      success: true,
      data: {
        summary,
        currentBalance: wallet?.balance || 0,
        limits: {
          daily: wallet?.dailyLimit || 0,
          monthly: wallet?.monthlyLimit || 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [STATS ERROR]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
};

// Export rate limiters with controllers
module.exports = {
  getWallet: exports.getWallet,
  getTransactions: exports.getTransactions,
  addMoney: exports.addMoney,
  deductMoney: exports.deductMoney,
  refundToWallet: exports.refundToWallet,
  checkBalance: exports.checkBalance,
  transferMoney: exports.transferMoney,
  getWalletStats: exports.getWalletStats,
  
  // Rate limiters
  addMoneyLimiter,
  transferLimiter
};