// ==================== controllers/realtimeController.js ====================
// Real-time updates using Socket.io

const Segment = require('../models/Segment');
const Route = require('../models/Route');

/**
 * Initialize real-time event handlers
 * Call this when socket connection is established
 */
exports.initializeSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`[SOCKET] New connection: ${socket.id}`);

    /**
     * Join user-specific room for private notifications
     */
    socket.on('join_user', (userId) => {
      socket.join(`user-${userId}`);
      console.log(`[SOCKET] User joined private room: user-${userId}`);
    });

    socket.on('join-user', (userId) => {
      socket.join(`user-${userId}`);
    });

    /**
     * Join a bus for real-time location updates
     */
    socket.on('join_bus', (busId) => {
      socket.join(`bus-${busId}`);
      console.log(`[SOCKET] User joined bus room: bus-${busId}`);
    });

    socket.on('join-bus', (busId) => {
      socket.join(`bus-${busId}`);
    });

    /**
     * Join a route for occupancy updates
     */
    socket.on('join_route', (routeId) => {
      socket.join(`route-${routeId}`);
      console.log(`[SOCKET] User joined route room: route-${routeId}`);
    });

    socket.on('join-route', (data) => {
      const routeId = data.routeId || data;
      socket.join(`route-${routeId}`);
    });

    /**
     * Join bus owner dashboard
     */
    socket.on('join-owner-dashboard', (data) => {
      const { ownerId } = data;
      const room = `owner-${ownerId}`;
      socket.join(room);
      console.log(`[SOCKET] Owner joined dashboard: ${ownerId}`);
    });

    /**
     * Receive booking confirmation and broadcast availability update
     * Event: 'booking-confirmed'
     * Data: { routeId, seatsBooked }
     */
    socket.on('booking-confirmed', async (data) => {
      const { routeId, seatsBooked } = data;
      console.log(`[SOCKET] Booking confirmed on route ${routeId}: ${seatsBooked} seats`);

      // Broadcast updated occupancy to all users on this route
      broadcastRouteOccupancy(io, routeId);
    });

    /**
     * Admin/Owner triggers real-time announcement
     * Event: 'broadcast-announcement'
     * Data: { type, message, routeId?, affectsBuses? }
     */
    socket.on('broadcast-announcement', (data) => {
      const { type, message, routeId, affectsBuses } = data;

      if (routeId) {
        // Send to specific route room
        io.to(`route-${routeId}`).emit('announcement', {
          type,
          message,
          timestamp: new Date()
        });
      } else if (affectsBuses) {
        // Send to specific buses
        affectsBuses.forEach(busId => {
          io.to(`bus-${busId}`).emit('announcement', {
            type,
            message,
            timestamp: new Date()
          });
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
  });
};

/**
 * Broadcast current occupancy for a route to all connected users
 */
async function broadcastRouteOccupancy(io, routeId) {
  try {
    const route = await Route.findById(routeId).populate('busId', 'totalSeats');
    if (!route) return;

    const bookedSeats = await Segment.countDocuments({
      routeId,
      status: { $in: ['confirmed', 'boarded', 'completed'] }
    });

    const occupancy = {
      routeId,
      total: route.busId.totalSeats,
      booked: bookedSeats,
      available: route.busId.totalSeats - bookedSeats,
      percentage: Math.round((bookedSeats / route.busId.totalSeats) * 100),
      timestamp: new Date()
    };

    io.to(`route-${routeId}`).emit('occupancy-update', occupancy);
    console.log(`[SOCKET] Sent occupancy update for route ${routeId}:`, occupancy);

  } catch (error) {
    console.error('[SOCKET] Error broadcasting occupancy:', error);
  }
}

/**
 * API endpoint to trigger real-time update
 * Called when a booking is confirmed
 */
exports.notifyBookingConfirmed = async (req, res) => {
  try {
    const { routeId, segmentId, seatsBooked } = req.body;

    // Get Socket.io instance from global
    const io = global.io;
    if (!io) {
      return res.status(500).json({ success: false, message: 'Socket.io not initialized' });
    }

    // Broadcast to route subscribers
    io.to(`route-${routeId}`).emit('seat-booked', {
      segmentId,
      seatsBooked,
      timestamp: new Date()
    });

    // Update and broadcast occupancy
    await broadcastRouteOccupancy(io, routeId);

    res.json({
      success: true,
      message: 'Booking notification sent to all connected users'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * API endpoint to notify bus location update
 */
exports.notifyBusLocationUpdate = async (req, res) => {
  try {
    const { routeId, busId, latitude, longitude, currentStop } = req.body;

    const io = global.io;
    if (!io) {
      return res.status(500).json({ success: false, message: 'Socket.io not initialized' });
    }

    io.to(`route-${routeId}`).emit('bus-location', {
      busId,
      location: { latitude, longitude },
      currentStop,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Location update sent to all connected users'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * API endpoint to send real-time notification
 */
exports.sendRealTimeNotification = async (req, res) => {
  try {
    const { userId, type, title, message, data } = req.body;

    const io = global.io;
    if (!io) {
      return res.status(500).json({ success: false, message: 'Socket.io not initialized' });
    }

    io.to(`user-${userId}`).emit('notification', {
      type,
      title,
      message,
      data,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Notification sent'
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  initializeSocketHandlers: exports.initializeSocketHandlers,
  notifyBookingConfirmed: exports.notifyBookingConfirmed,
  notifyBusLocationUpdate: exports.notifyBusLocationUpdate,
  sendRealTimeNotification: exports.sendRealTimeNotification
};
