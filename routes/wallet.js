// ==================== routes/wallet.js (PRODUCTION-READY) ====================
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middleware/auth');

// All wallet routes require authentication
router.use(auth.protect);

// ==================== WALLET ROUTES ====================

/**
 * @route   GET /api/wallet
 * @desc    Get wallet details and summary
 * @access  Private
 */
router.get('/', walletController.getWallet);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get transaction history with pagination
 * @access  Private
 * @query   limit, page, type, status, startDate, endDate
 */
router.get('/transactions', walletController.getTransactions);

/**
 * @route   GET /api/wallet/stats
 * @desc    Get wallet statistics
 * @access  Private
 * @query   period (day, week, month, year)
 */
router.get('/stats', walletController.getWalletStats);

/**
 * @route   GET /api/wallet/check-balance
 * @desc    Check if sufficient balance for transaction
 * @access  Private
 * @query   requiredAmount
 */
router.get('/check-balance', walletController.checkBalance);

/**
 * @route   POST /api/wallet/add-money
 * @desc    Add money to wallet
 * @access  Private
 * @body    amount, source, paymentMethod, idempotencyKey
 */
router.post(
  '/add-money',
  walletController.addMoneyLimiter, // Rate limit: 5 requests per 15 minutes
  walletController.addMoney
);

/**
 * @route   POST /api/wallet/refund
 * @desc    Refund money to wallet
 * @access  Private/Admin
 * @body    amount, bookingId, reason, idempotencyKey
 */
router.post('/refund', walletController.refundToWallet);

/**
 * @route   POST /api/wallet/transfer
 * @desc    Transfer money to another user (P2P)
 * @access  Private
 * @body    recipientUserId, amount, note, idempotencyKey
 */
router.post(
  '/transfer',
  walletController.transferLimiter, // Rate limit: 10 requests per hour
  walletController.transferMoney
);

module.exports = router;