// ==================== controllers/notificationController.js ====================
const Notification = require('../models/Notification');
const { sendBroadcastNotification, sendNotification, sendTopicNotification } = require('../utils/notifications');

/**
 * Notification Controller
 */

// Get user notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;
    const limitNum = parseInt(limit);
    const skipNum = (parseInt(page) - 1) * limitNum;

    // Fetch user-specific notifications
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .lean();

    // Fetch global announcements
    const GlobalAnnouncement = require('../models/GlobalAnnouncement');
    const globalAnnouncements = await GlobalAnnouncement.find({
      isActive: true,
      targetRoles: { $in: ['all', req.userRole || 'customer'] }
    })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .lean();

    // Format globals to match Notification schema
    const formattedGlobals = globalAnnouncements.map(ga => ({
      _id: ga._id,
      userId: userId,
      title: ga.title,
      body: ga.body,
      type: 'admin_msg',
      status: 'unread',
      createdAt: ga.createdAt,
      isGlobal: true
    }));

    // Merge, sort, and slice to limit
    const allNotifications = [...notifications, ...formattedGlobals]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limitNum);

    const totalUserNotifs = await Notification.countDocuments({ userId });
    const totalGlobals = await GlobalAnnouncement.countDocuments({
      isActive: true,
      targetRoles: { $in: ['all', req.userRole || 'customer'] }
    });
    
    const total = totalUserNotifs + totalGlobals;
    const unreadCount = await Notification.countDocuments({ userId, status: 'unread' });

    res.status(200).json({
      success: true,
      data: {
        notifications: allNotifications,
        meta: {
          total,
          unreadCount,
          page: parseInt(page),
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.userId,
      status: 'unread'
    });
    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get notification by ID
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // If id is 'all', mark all as read
    if (id === 'all') {
      await Notification.updateMany(
        { userId: req.user._id, status: 'unread' },
        { status: 'read', readAt: new Date() }
      );
      return res.status(200).json({ success: true, message: 'All notifications marked as read' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { status: 'read', readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send notification (Admin)
exports.sendNotification = async (req, res) => {
  try {
    const { userId, title, message, type, isBroadcast } = req.body;

    if (isBroadcast) {
      const result = await sendBroadcastNotification({
        title,
        body: message,
        type: type || 'admin_alert',
        adminId: req.userId || req.user?._id,
        data: { fromAdmin: true }
      });

      if (!result) {
        return res.status(500).json({ success: false, message: 'Failed to send broadcast notification' });
      }
      return res.status(200).json({ success: true, message: 'Broadcast sent to all users' });
    }

    // Single user
    if (!userId) {
      return res.status(400).json({ success: false, message: 'UserId is required for single notification' });
    }

    await sendNotification(userId, {
      title,
      body: message,
      type: type || 'admin_msg',
      data: { fromAdmin: true }
    });

    res.status(200).json({ success: true, message: 'Notification sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Test Push Notification (Self)
exports.testPush = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title = "Test Notification", message = "This is a test push from the server." } = req.body;

    console.log(`🧪 Sending test push to user: ${userId}`);

    const notification = await sendNotification(userId, {
      title,
      body: message,
      type: 'system_alert',
      data: { isTest: true }
    });

    if (!notification) {
      return res.status(500).json({ success: false, message: 'Failed to queue notification' });
    }

    res.status(200).json({
      success: true,
      message: 'Test notification triggered. Check your device and server logs.',
      data: { notificationId: notification._id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- New Bus-Specific notification methods ---

// Bus location update notification
exports.busLocationUpdate = async (req, res) => {
  try {
    const { busId, latitude, longitude, routeId, status } = req.body;

    if (!busId || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'busId, latitude, and longitude are required' });
    }

    const result = await sendTopicNotification(`bus_${busId}`, {
      title: 'Bus Location Updated',
      body: `Bus ${busId} location has been updated`,
      type: 'bus_location',
      data: {
        busId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        routeId: routeId || '',
        status: status || '',
      }
    });

    res.status(200).json({
      success: true,
      message: 'Bus location notification sent',
      messageId: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bus delay notification
exports.busDelayNotification = async (req, res) => {
  try {
    const { busId, delayMinutes, reason } = req.body;

    if (!busId || !delayMinutes) {
      return res.status(400).json({ success: false, message: 'busId and delayMinutes are required' });
    }

    const result = await sendTopicNotification(`bus_${busId}`, {
      title: 'Bus Delayed',
      body: `Bus ${busId} is delayed by ${delayMinutes} minutes${reason ? ': ' + reason : ''}`,
      type: 'delay',
      data: {
        busId,
        delayMinutes: delayMinutes.toString(),
        reason: reason || ''
      }
    });

    res.status(200).json({
      success: true,
      message: 'Delay notification sent',
      messageId: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Booking confirmation
exports.bookingConfirmation = async (req, res) => {
  try {
    const { userId, bookingId, busId, seatNumber } = req.body;

    if (!userId || !bookingId || !busId) {
      return res.status(400).json({ success: false, message: 'userId, bookingId, and busId are required' });
    }

    const result = await sendNotification(userId, {
      title: 'Booking Confirmed',
      body: `Your booking for Bus ${busId} is confirmed. Seat: ${seatNumber || 'N/A'}`,
      type: 'booking_confirmation',
      data: {
        bookingId,
        busId,
        seatNumber: seatNumber || ''
      }
    });

    res.status(200).json({
      success: true,
      message: 'Booking confirmation sent',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Booking cancellation
exports.bookingCancellation = async (req, res) => {
  try {
    const { userId, bookingId, reason } = req.body;

    if (!userId || !bookingId) {
      return res.status(400).json({ success: false, message: 'userId and bookingId are required' });
    }

    const result = await sendNotification(userId, {
      title: 'Booking Cancelled',
      body: `Your booking ${bookingId} has been cancelled${reason ? ': ' + reason : ''}`,
      type: 'booking_cancellation',
      data: {
        bookingId,
        reason: reason || ''
      }
    });

    res.status(200).json({
      success: true,
      message: 'Booking cancellation sent',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get active topics for a user to subscribe to
exports.getActiveTopics = async (req, res) => {
  try {
    const Segment = require('../models/Segment');
    const TripTimeline = require('../models/TripTimeline');
    
    // Find active segments for the user (today or future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const segments = await Segment.find({
      customerId: req.userId,
      travelDate: { $gte: today },
      status: { $in: ['booked', 'confirmed', 'boarded', 'completed'] } // Keep completed briefly so they get final arrival push
    }).select('busId travelDate routeId');

    const topics = new Set();
    
    // Global topics
    topics.add('all_users');
    topics.add(`role_${req.userRole || 'customer'}`);

    for (const seg of segments) {
      if (seg.busId) {
        topics.add(`bus_${seg.busId}`);
      }
      
      // Attempt to find active trip for this route/bus/date
      const tripDateStart = new Date(seg.travelDate);
      tripDateStart.setHours(0,0,0,0);
      const tripDateEnd = new Date(seg.travelDate);
      tripDateEnd.setHours(23,59,59,999);

      const trip = await TripTimeline.findOne({
        busId: seg.busId,
        serviceDate: { $gte: tripDateStart, $lt: tripDateEnd }
      }).select('_id');
      
      if (trip) {
        topics.add(`trip_${trip._id}`);
      }
    }

    res.status(200).json({ success: true, topics: Array.from(topics) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
