// ==================== utils/validators.js ====================

/**
 * Validate and sanitize amount
 */
exports.validateAmount = (amount, min = 0, max = Infinity) => {
  const numAmount = parseFloat(amount);
  
  if (isNaN(numAmount)) {
    throw new Error('Amount must be a valid number');
  }
  
  if (numAmount < min) {
    throw new Error(`Amount must be at least ₹${min}`);
  }
  
  if (numAmount > max) {
    throw new Error(`Amount cannot exceed ₹${max}`);
  }
  
  // Round to 2 decimal places
  return Math.round(numAmount * 100) / 100;
};

/**
 * Validate transaction ID format
 */
exports.validateTransactionId = (transactionId) => {
  if (!transactionId || typeof transactionId !== 'string') {
    throw new Error('Invalid transaction ID');
  }
  
  // Transaction ID should match pattern: PREFIX + timestamp + random
  const pattern = /^[A-Z]{3}\d{13}[A-Z0-9]{9}$/;
  
  if (!pattern.test(transactionId)) {
    throw new Error('Transaction ID format is invalid');
  }
  
  return transactionId;
};

/**
 * Sanitize user input
 */
exports.sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Remove HTML tags, script tags, and special characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[<>]/g, '')
    .trim();
};

/**
 * Validate user ID
 */
exports.validateUserId = (userId) => {
  const mongoose = require('mongoose');
  
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID format');
  }
  
  return userId;
};

/**
 * Validate booking ID
 */
exports.validateBookingId = (bookingId) => {
  const mongoose = require('mongoose');
  
  if (!bookingId) {
    return null;
  }
  
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new Error('Invalid booking ID format');
  }
  
  return bookingId;
};

/**
 * Validate currency code
 */
exports.validateCurrency = (currency) => {
  const validCurrencies = ['INR', 'USD', 'EUR'];
  
  const upperCurrency = currency?.toUpperCase();
  
  if (!validCurrencies.includes(upperCurrency)) {
    throw new Error(`Currency must be one of: ${validCurrencies.join(', ')}`);
  }
  
  return upperCurrency;
};

/**
 * Validate pagination params
 */
exports.validatePagination = (limit, page) => {
  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const validatedPage = Math.max(parseInt(page) || 1, 1);
  
  return {
    limit: validatedLimit,
    page: validatedPage
  };
};

/**
 * Validate date range
 */
exports.validateDateRange = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  if (start && isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }
  
  if (end && isNaN(end.getTime())) {
    throw new Error('Invalid end date');
  }
  
  if (start && end && start > end) {
    throw new Error('Start date must be before end date');
  }
  
  return { startDate: start, endDate: end };
};

/**
 * Validate idempotency key format
 */
exports.validateIdempotencyKey = (key) => {
  if (!key) {
    return null;
  }
  
  if (typeof key !== 'string') {
    throw new Error('Idempotency key must be a string');
  }
  
  if (key.length < 10 || key.length > 100) {
    throw new Error('Idempotency key must be between 10 and 100 characters');
  }
  
  // Allow alphanumeric, hyphens, and underscores
  const pattern = /^[a-zA-Z0-9_-]+$/;
  if (!pattern.test(key)) {
    throw new Error('Idempotency key contains invalid characters');
  }
  
  return key;
};

/**
 * Format amount for display
 */
exports.formatAmount = (amount, currency = 'INR') => {
  const numAmount = parseFloat(amount) || 0;
  
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€'
  };
  
  const symbol = symbols[currency] || currency;
  return `${symbol}${numAmount.toFixed(2)}`;
};

/**
 * Validate phone number (Indian format)
 */
exports.validatePhoneNumber = (phone) => {
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  // Indian phone number: 10 digits, optionally starting with +91
  const pattern = /^(\+91)?[6-9]\d{9}$/;
  
  const cleanPhone = phone.replace(/\s+/g, '');
  
  if (!pattern.test(cleanPhone)) {
    throw new Error('Invalid Indian phone number');
  }
  
  return cleanPhone;
};

/**
 * Validate email
 */
exports.validateEmail = (email) => {
  if (!email) {
    throw new Error('Email is required');
  }
  
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!pattern.test(email)) {
    throw new Error('Invalid email format');
  }
  
  return email.toLowerCase();
};

/**
 * Generate unique transaction ID
 */
exports.generateTransactionId = (prefix = 'TXN') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Validate transaction type
 */
exports.validateTransactionType = (type) => {
  const validTypes = ['credit', 'debit', 'refund', 'transfer_in', 'transfer_out'];
  
  if (!validTypes.includes(type)) {
    throw new Error(`Transaction type must be one of: ${validTypes.join(', ')}`);
  }
  
  return type;
};

/**
 * Validate transaction status
 */
exports.validateTransactionStatus = (status) => {
  const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return status;
};