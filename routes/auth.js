// ==================== routes/auth.js ====================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public routes
router.post('/send-otp', authController.sendOTP);
router.post('/send-email-otp', authController.sendEmailOTP);
router.post('/verify-email-otp', authController.verifyEmailOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/reset-password', authController.resetPasswordWithOTP);
router.post('/test-login', authController.testLogin); // ⚠️ TEMPORARY: Remove in production

// Protected routes
router.get('/me', auth.verifyToken, authController.getCurrentUser);
router.put('/profile', auth.verifyToken, authController.updateProfile);
router.post('/fcm-token', auth.verifyToken, authController.updateFCMToken);

module.exports = router;
