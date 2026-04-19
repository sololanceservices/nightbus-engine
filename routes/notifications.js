// ==================== routes/notifications.js ====================
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

const noCache = (req, res, next) => {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
};

// Protected routes
router.use(noCache);
router.get('/', auth.verifyToken, notificationController.getUserNotifications);
router.get('/unread-count', auth.verifyToken, notificationController.getUnreadCount);
router.get('/:id', auth.verifyToken, notificationController.getNotificationById);
router.put('/:id/read', auth.verifyToken, notificationController.markAsRead);
router.delete('/:id', auth.verifyToken, notificationController.deleteNotification);
router.post('/send', auth.verifyToken, auth.checkRole(['admin', 'owner']), notificationController.sendNotification);
router.post('/test-push', auth.verifyToken, notificationController.testPush);

// Bus-specific notification routes
router.post('/bus-location-update', auth.verifyToken, notificationController.busLocationUpdate);
router.post('/bus-delay-notification', auth.verifyToken, notificationController.busDelayNotification);
router.post('/booking-confirmation', auth.verifyToken, notificationController.bookingConfirmation);
router.post('/booking-cancellation', auth.verifyToken, notificationController.bookingCancellation);

module.exports = router;
