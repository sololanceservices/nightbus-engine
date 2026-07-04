// ==================== controllers/busOwnerController.js (COMPLETE & PRODUCTION-READY) ====================
const Bus = require('../models/Bus');
const mongoose = require('mongoose');
const Route = require('../models/Route');
const Segment = require('../models/Segment');
const User = require('../models/User');
const StaffAssignment = require('../models/StaffAssignment');
const Notification = require('../models/Notification');
const Settlement = require('../models/Settlement');
const Payment = require('../models/Payment');
const bcrypt = require('bcryptjs');
const walletController = require('./walletController');
const { sendNotification } = require('../utils/notifications');

// ==================== SETTINGS ====================
exports.getOwnerSettings = async (req, res) => {
  try {
    const ownerId = req.userId;
    const user = await User.findById(ownerId).select('ownerSettings');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        settings: user.ownerSettings || { autoConfirmBookings: false }
      }
    });
  } catch (error) {
    console.error('❌ Get settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOwnerSettings = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { autoConfirmBookings } = req.body;

    const user = await User.findById(ownerId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.ownerSettings) {
      user.ownerSettings = {};
    }

    user.ownerSettings.autoConfirmBookings = autoConfirmBookings;
    await user.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings: user.ownerSettings }
    });
  } catch (error) {
    console.error('❌ Update settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BUS MANAGEMENT ====================
exports.createBus = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { permitNumber, insurancePolicyNumber, fitnessNumber } = req.body;

    if (!permitNumber || !permitNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Permit number is mandatory' });
    }
    if (!insurancePolicyNumber || !insurancePolicyNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Insurance policy number is mandatory' });
    }
    if (!fitnessNumber || !fitnessNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Fitness certificate number is mandatory' });
    }

    const busData = { ...req.body, ownerId };

    const bus = new Bus(busData);
    await bus.save();

    res.status(201).json({
      success: true,
      message: 'Bus created successfully',
      data: { bus }
    });
  } catch (error) {
    console.error('❌ Create bus error:', error);
    
    // Handle duplicate key error (MongoDB 11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const message = field === 'chassisNumber' 
        ? 'A bus with this Chassis Number already exists.' 
        : field === 'registrationNumber' 
          ? 'A bus with this Registration Number already exists.'
          : 'This bus is already registered.';
      return res.status(400).json({ success: false, message });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOwnerBuses = async (req, res) => {
  try {
    const ownerId = req.userId;
    const buses = await Bus.find({ ownerId });

    // Calculate routeCount and totalSegments (trips) dynamically for each bus
    const busesWithStats = await Promise.all(buses.map(async (bus) => {
      const routeCount = await Route.countDocuments({ busId: bus._id, isActive: true });
      const totalSegments = await Segment.countDocuments({ busId: bus._id });
      return {
        ...bus.toObject(),
        routeCount,
        totalSegments
      };
    }));

    res.json({
      success: true,
      data: { buses: busesWithStats }
    });
  } catch (error) {
    console.error('❌ Get owner buses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBusDetails = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;

    const bus = await Bus.findOne({ _id: busId, ownerId });
    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }

    // Get active routes for this bus
    const routes = await Route.find({ ownerId, busId, isActive: true });

    // Today's Bookings & Stats
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const todayBookings = await Segment.find({
      busId,
      travelDate: {
        $gte: startOfToday,
        $lt: endOfToday
      }
    })
      .populate('customerId', 'name phone')
      .sort('seatNumber');

    // Calculate Today's Performance Stats
    const confirmedStatuses = ['confirmed', 'boarded', 'in_transit', 'completed'];
    const confirmedBookings = todayBookings.filter(b => confirmedStatuses.includes(b.status));

    // 1. Revenue (Sum of ownerEarnings for confirmed/boarded etc)
    const revenue = confirmedBookings.reduce((sum, b) => sum + (b.ownerEarnings || 0), 0);

    // 2. Trip Count (Unique journeys today)
    const uniqueJourneys = [...new Set(todayBookings.map(b => b.journeyId.toString()))];
    const tripsCount = uniqueJourneys.length;

    // 3. Occupancy (Total Confirmed Seats / (Total Seats * Trips))
    let occupancy = 0;
    if (tripsCount > 0 && bus.totalSeats > 0) {
      const totalPossibleSeats = bus.totalSeats * tripsCount;
      occupancy = Math.round((confirmedBookings.length / totalPossibleSeats) * 100);
    }

    res.json({
      success: true,
      data: {
        bus,
        routes,
        todayBookings,
        stats: {
          revenue,
          occupancy,
          trips: tripsCount
        }
      }
    });

  } catch (error) {
    console.error('❌ Get bus details error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update bus
 */
exports.updateBus = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;
    const updates = req.body;

    const bus = await Bus.findOne({ _id: busId, ownerId });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'busName',
      'busType',
      'totalSeats',
      'amenities',
      'externalPlatforms',
      'bookingSettings',
      'isActive',
      'status',
      'homeDepot',
      'insurancePolicyNumber',
      'permitNumber',
      'fitnessNumber',
      'fuelType',
      'condition',
      'gpsDeviceId',
      'gpsProvider'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        bus[field] = updates[field];
      }
    });

    await bus.save();

    res.json({
      success: true,
      message: 'Bus updated successfully',
      data: { bus }
    });

  } catch (error) {
    console.error('❌ Update bus error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Configure seat platforms (mark seats as registered on external platforms)
 */
exports.configureSeatPlatforms = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;
    const { seatNumber, platforms } = req.body;

    const bus = await Bus.findOne({ _id: busId, ownerId });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }

    // Find seat
    const seat = bus.seatConfiguration.find(s => s.seatNumber === seatNumber);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    // Update platforms
    seat.registeredOn = platforms.map(p => ({
      platform: p.platform,
      platformSeatId: p.platformSeatId,
      registeredDate: new Date(),
      isActive: true
    }));

    await bus.save();

    res.json({
      success: true,
      message: 'Seat platforms updated',
      data: { seat }
    });

  } catch (error) {
    console.error('❌ Configure seat platforms error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get live trip for a bus
 */
exports.getLiveTrip = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;

    // Verify bus ownership
    const bus = await Bus.findOne({ _id: busId, ownerId });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    // Today's range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find active trip today
    const liveTrip = await Segment.findOne({
      busId,
      travelDate: { $gte: today, $lt: tomorrow },
      status: { $in: ['confirmed', 'boarded', 'in_transit'] }
    }).populate('routeId');

    res.json({ success: true, data: { liveTrip } });
  } catch (error) {
    console.error('❌ Get live trip error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get trip history for a bus
 */
exports.getBusTripHistory = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;

    // Verify bus ownership
    const bus = await Bus.findOne({ _id: busId, ownerId });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    const history = await Segment.find({ busId })
      .populate('routeId')
      .sort({ travelDate: -1 })
      .limit(50);

    res.json({ success: true, data: { history } });
  } catch (error) {
    console.error('❌ Get bus history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete bus
 */
exports.deleteBus = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;

    const bus = await Bus.findOneAndDelete({ _id: busId, ownerId });

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: 'Bus not found'
      });
    }

    res.json({
      success: true,
      message: 'Bus deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete bus error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== ROUTE MANAGEMENT ====================
exports.createRoute = async (req, res) => {
  try {
    const ownerId = req.userId;
    const routeData = { ...req.body, ownerId };

    const route = new Route(routeData);
    await route.save();

    res.status(201).json({
      success: true,
      message: 'Route created successfully',
      data: { route }
    });
  } catch (error) {
    console.error('❌ Create route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOwnerRoutes = async (req, res) => {
  try {
    const ownerId = req.userId;
    const routes = await Route.find({ ownerId });

    res.json({
      success: true,
      data: { routes }
    });
  } catch (error) {
    console.error('❌ Get owner routes error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRoute = async (req, res) => {
  try {
    const { routeId } = req.params;
    const ownerId = req.userId;
    const updates = req.body;

    const route = await Route.findOneAndUpdate(
      { _id: routeId, ownerId },
      updates,
      { new: true }
    );

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.json({
      success: true,
      message: 'Route updated successfully',
      data: { route }
    });
  } catch (error) {
    console.error('❌ Update route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRoute = async (req, res) => {
  try {
    const { routeId } = req.params;
    const ownerId = req.userId;

    const route = await Route.findOneAndDelete({ _id: routeId, ownerId });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.json({
      success: true,
      message: 'Route deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete route error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRouteDetails = async (req, res) => {
  try {
    const { routeId } = req.params;
    const ownerId = req.userId;

    const route = await Route.findOne({ _id: routeId, ownerId })
      .populate('busId');
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    // Get today's segments for this route
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeSegments = await Segment.find({
      routeId,
      travelDate: { $gte: today, $lt: tomorrow }
    }).populate('customerId', 'name phone');

    res.json({
      success: true,
      data: { 
        route,
        activeSegments
      }
    });
  } catch (error) {
    console.error('❌ Get route details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBusRoutes = async (req, res) => {
  try {
    const { busId } = req.params;
    const ownerId = req.userId;

    const routes = await Route.find({ busId, ownerId });
    res.json({ success: true, data: { routes } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRouteStops = async (req, res) => {
  try {
    const { routeId } = req.params;
    const { stops, pathCoordinates, rounds, totalDistance, estimatedDuration } = req.body;
    const ownerId = req.userId;

    const route = await Route.findOne({ _id: routeId, ownerId });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    route.stops = stops;
    if (pathCoordinates) route.pathCoordinates = pathCoordinates;
    if (rounds) route.rounds = rounds;
    if (totalDistance !== undefined) route.totalDistance = totalDistance;
    if (estimatedDuration !== undefined) route.estimatedDuration = estimatedDuration;

    await route.save();

    res.json({ success: true, message: 'Stops updated successfully', data: { route } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BOOKING APPROVAL ====================

/**
 * Get pending approvals
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { status = 'pending' } = req.query;

    const Bus = require('../models/Bus');
    const Segment = require('../models/Segment');

    const buses = await Bus.find({ ownerId }, '_id');
    const busIds = buses.map(b => b._id);

    let query = {
      busId: { $in: busIds }
    };

    if (status === 'pending') {
      query.status = { $in: ['requested', 'pending_approval'] };
      query.approvalStatus = 'pending';
    } else if (status === 'confirmed') {
      query.status = { $in: ['confirmed', 'boarded', 'in_transit', 'completed'] };
    } else if (status === 'rejected') {
      query.status = 'rejected';
    }

    const segments = await Segment.find(query)
      .populate('customerId', 'name phone')
      .populate('busId', 'chassisNumber busType busNumber')
      .populate('routeId', 'routeName')
      .sort('-createdAt');

    res.json({
      success: true,
      count: segments.length,
      data: { segments }
    });

  } catch (error) {
    console.error('❌ Get pending approvals error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Approve booking
 */
exports.approveBooking = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const ownerId = req.userId;

    const segment = await Segment.findById(segmentId)
      .populate('busId')
      .populate('customerId', 'name phone');

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify ownership
    if (segment.busId.ownerId.toString() !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check if already processed
    if (segment.status !== 'requested' && segment.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${segment.status}`
      });
    }

    // Approve
    await segment.approve(ownerId);

    res.json({
      success: true,
      message: 'Booking approved successfully',
      data: { segment }
    });

  } catch (error) {
    console.error('❌ Approve booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Reject booking
 */
exports.rejectBooking = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const ownerId = req.userId;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const segment = await Segment.findById(segmentId)
      .populate('busId')
      .populate('customerId', 'name phone');

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Verify ownership
    if (segment.busId.ownerId.toString() !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check if already processed
    if (segment.status !== 'requested' && segment.status !== 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${segment.status}`
      });
    }

    // Reject
    await segment.reject(ownerId, reason);

    res.json({
      success: true,
      message: 'Booking rejected successfully',
      data: { segment }
    });

  } catch (error) {
    console.error('❌ Reject booking error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== STAFF MANAGEMENT ====================

exports.getOwnerStaff = async (req, res) => {
  try {
    const ownerId = req.userId;
    const staff = await User.find({ ownerId, role: 'staff' });
    
    // Get assignments for each staff
    const staffWithAssignments = await Promise.all(staff.map(async (s) => {
      const assignment = await StaffAssignment.findOne({ staffId: s._id, status: { $in: ['assigned', 'started'] } })
        .populate('busId', 'chassisNumber busName busNumber registrationNumber');
      
      let currentAssignment = null;
      if (assignment) {
        currentAssignment = {
          ...assignment.toObject(),
          busNumber: assignment.busId?.busNumber || assignment.busId?.registrationNumber || 'Assigned Bus'
        };
      }

      return {
        ...s.toObject(),
        assignment,
        currentAssignment
      };
    }));

    res.json({ success: true, data: { staff: staffWithAssignments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Create new staff member
 */
exports.createStaff = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { name, phone, email, password, staffRole, assignedBus, permissions, salary, licenseNumber } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this phone already exists' });
    }

    // 2. Create staff user
    // Do NOT pre-hash password here as the User model has a pre-save hook that hashes it.
    const staff = new User({
      name,
      phone,
      email: email || undefined,
      password: password || 'staff123',
      plainPassword: password || 'staff123',
      role: 'staff',
      ownerId,
      staffRole,
      assignedBus,
      permissions,
      salary: salary || 0,
      licenseNumber: licenseNumber || undefined,
      isActive: true
    });

    await staff.save();

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: { staff: { _id: staff._id, name, phone, staffRole, plainPassword: staff.plainPassword } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update staff member
 */
exports.updateStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const ownerId = req.userId;
    const updates = req.body;

    const staff = await User.findOne({ _id: staffId, ownerId, role: 'staff' });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });

    // Handle password update if provided and different
    if (updates.password && updates.password !== staff.plainPassword) {
      staff.password = updates.password;
      staff.plainPassword = updates.password;
    }

    // Update other fields
    if (updates.name) staff.name = updates.name;
    if (updates.phone) staff.phone = updates.phone;
    if (updates.email !== undefined) staff.email = updates.email || undefined;
    if (updates.salary !== undefined) staff.salary = updates.salary;
    if (updates.licenseNumber !== undefined) staff.licenseNumber = updates.licenseNumber || undefined;
    if (updates.isActive !== undefined) staff.isActive = updates.isActive;
    if (updates.permissions) {
      staff.set('permissions', updates.permissions);
      staff.markModified('permissions');
    }

    await staff.save();

    // Remove password from response
    const staffObj = staff.toObject();
    delete staffObj.password;

    res.json({ success: true, message: 'Staff member updated', data: { staff: staffObj } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignStaff = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { staffId, busId, role, shiftDate, shiftStartTime, shiftEndTime } = req.body;

    // 1. Verify staff and bus belong to owner
    const [staff, bus] = await Promise.all([
      User.findOne({ _id: staffId, ownerId, role: 'staff' }),
      Bus.findOne({ _id: busId, ownerId })
    ]);

    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    // 2. Deactivate any existing active assignments for this staff
    await StaffAssignment.updateMany(
      { staffId, status: { $in: ['assigned', 'started'] } },
      { status: 'cancelled', completedAt: new Date() }
    );

    // 3. Create new assignment
    const assignment = new StaffAssignment({
      staffId,
      busId,
      ownerId,
      role,
      shiftDate: shiftDate ? new Date(shiftDate) : new Date(),
      shiftStartTime: shiftStartTime || '06:00',
      shiftEndTime: shiftEndTime || '18:00',
      status: 'assigned'
    });

    await assignment.save();

    // 4. Update User model shortcuts
    staff.assignedBus = busId;
    staff.staffRole = role;
    await staff.save();

    res.json({ success: true, message: 'Staff assigned successfully', data: { assignment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStaffAssignments = async (req, res) => {
  try {
    const ownerId = req.userId;
    const assignments = await StaffAssignment.find({ ownerId })
      .populate('staffId', 'name phone')
      .populate('busId', 'chassisNumber busName busNumber registrationNumber')
      .sort('-createdAt');

    res.json({ success: true, data: { assignments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStaffStatus = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { isActive } = req.body;
    const ownerId = req.userId;

    const staff = await User.findOneAndUpdate(
      { _id: staffId, ownerId, role: 'staff' },
      { isActive },
      { new: true }
    );

    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    res.json({ success: true, message: 'Staff status updated', data: { staff } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== DASHBOARD & ANALYTICS ====================

/**
 * Get dashboard stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.userId;

    // Get owner's buses
    const buses = await Bus.find({ ownerId });
    const busIds = buses.map(b => b._id);

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all stats in parallel
    const [
      todaySegments,
      pendingCount,
      activeTrips,
      monthlyRevenue,
      totalRoutes
    ] = await Promise.all([
      Segment.find({
        busId: { $in: busIds },
        travelDate: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'boarded', 'completed'] }
      }),
      Segment.countDocuments({
        busId: { $in: busIds },
        status: { $in: ['requested', 'pending_approval'] }
      }),
      Segment.countDocuments({
        busId: { $in: busIds },
        travelDate: { $gte: today, $lt: tomorrow },
        status: 'boarded'
      }),
      Segment.aggregate([
        {
          $match: {
            busId: { $in: busIds },
            status: { $in: ['completed', 'boarded'] },
            createdAt: {
              $gte: new Date(today.getFullYear(), today.getMonth(), 1)
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalAmount' },
            earnings: { $sum: '$ownerEarnings' }
          }
        }
      ]),
      Route.countDocuments({
        busId: { $in: busIds },
        isActive: true
      })
    ]);

    const revenueToday = todaySegments.reduce((sum, s) => sum + (s.ownerEarnings || 0), 0);

    res.json({
      success: true,
      data: {
        stats: {
          revenueToday,
          revenueMonthly: monthlyRevenue[0]?.earnings || 0,
          pendingApprovals: pendingCount,
          activeTrips,
          busesCount: buses.length,
          routesCount: totalRoutes
        },
        recentActivity: todaySegments.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get revenue analytics
 */
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { period = '7days' } = req.query;

    const buses = await Bus.find({ ownerId }, '_id');
    const busIds = buses.map(b => b._id);

    let startDate = new Date();
    if (period === '7days') startDate.setDate(startDate.getDate() - 7);
    else if (period === '30days') startDate.setDate(startDate.getDate() - 30);
    else if (period === 'today') startDate.setHours(0, 0, 0, 0);

    const revenueData = await Segment.aggregate([
      {
        $match: {
          busId: { $in: busIds },
          status: { $in: ['completed', 'boarded', 'in_transit', 'confirmed'] },
          travelDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$travelDate" } },
          revenue: { $sum: "$ownerEarnings" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: { revenueData }
    });

  } catch (error) {
    console.error('❌ Get revenue dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get upcoming journeys
 */
exports.getUpcomingJourneys = async (req, res) => {
  try {
    const ownerId = req.userId;
    const buses = await Bus.find({ ownerId }, '_id');
    const busIds = buses.map(b => b._id);

    const journeys = await Segment.find({
      busId: { $in: busIds },
      travelDate: { $gte: new Date() },
      status: 'confirmed'
    })
      .populate('routeId')
      .populate('busId')
      .sort('travelDate')
      .limit(10);

    res.json({
      success: true,
      data: { journeys }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FINANCE & SETTLEMENTS ====================

/**
 * Get owner settlements
 */
exports.getSettlements = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { status, limit = 20, page = 1 } = req.query;

    const query = { ownerId };
    if (status) query.status = status;

    const settlements = await Settlement.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Settlement.countDocuments(query);

    res.json({
      success: true,
      data: {
        settlements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get revenue transactions
 */
exports.getRevenueTransactions = async (req, res) => {
  try {
    const ownerId = req.userId;
    const { busId, startDate, endDate } = req.query;

    const buses = await Bus.find({ ownerId }, '_id');
    const busIds = buses.map(b => b._id);

    const query = { 
      busId: { $in: busIds },
      status: { $in: ['confirmed', 'boarded', 'completed'] }
    };

    if (busId) query.busId = busId;
    if (startDate || endDate) {
      query.travelDate = {};
      if (startDate) query.travelDate.$gte = new Date(startDate);
      if (endDate) query.travelDate.$lte = new Date(endDate);
    }

    const transactions = await Segment.find(query)
      .populate('busId', 'busName chassisNumber')
      .populate('routeId', 'routeName')
      .sort({ travelDate: -1 });

    res.json({
      success: true,
      data: { transactions }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * ==================== BROADCAST / ANNOUNCEMENTS ====================
 */

/**
 * Send announcement for a specific trip
 * Targets passengers of a specific bus with active bookings
 */
exports.sendTripAnnouncement = async (req, res) => {
  try {
    const { busId, title, body, statusFilter } = req.body;
    const ownerId = req.userId;

    // 1. Verify bus belongs to owner
    const bus = await Bus.findOne({ _id: busId, ownerId });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found or unauthorized' });
    }

    // 2. Find relevant passengers
    // We target passengers who are confirmed, boarded, or in_transit
    const targetStatuses = statusFilter || ['confirmed', 'boarded', 'in_transit'];
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeSegments = await Segment.find({
      busId,
      travelDate: { $gte: today, $lt: tomorrow },
      status: { $in: targetStatuses }
    }).select('customerId');

    const customerIds = [...new Set(activeSegments.map(s => s.customerId.toString()))];
    
    if (customerIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No active passengers found for this trip', count: 0 });
    }

    console.log(`📢 Sending announcement to ${customerIds.length} passengers of bus ${bus.busName}`);

    // 3. Send notifications in parallel
    const notificationPromises = customerIds.map(customerId => 
      sendNotification(customerId, {
        title: title || `Announcement from ${bus.busName || 'Bus Owner'}`,
        body: body || req.body.message || 'New update regarding your trip',
        type: 'bus_announcement',
        data: {
          busId,
          busName: bus.busName,
          category: 'trip_update'
        }
      })
    );

    await Promise.all(notificationPromises);

    res.status(200).json({
      success: true,
      message: 'Announcement sent successfully',
      recipientCount: customerIds.length
    });

  } catch (error) {
    console.error('❌ Trip announcement error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get bus bookings by specific date
 */
exports.getBusBookingsByDate = async (req, res) => {
  try {
    const { busId, date } = req.params;
    const ownerId = req.userId;

    // 1. Verify bus belongs to owner
    const bus = await Bus.findOne({ _id: busId, ownerId });
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found or unauthorized' });
    }

    // Parse date range (start of day to end of day)
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // Query segments for this bus on this date
    const segments = await Segment.find({
      busId,
      travelDate: { $gte: startDate, $lt: endDate }
    })
      .populate('customerId', 'name phone')
      .populate('routeId', 'routeName stops')
      .sort('departureTime');

    // Also get the routes running on this day to show all scheduled runs
    const routes = await Route.find({ busId, isActive: true })
      .populate('busId', 'busNumber busType');

    res.json({
      success: true,
      data: {
        date,
        bus: {
          _id: bus._id,
          busName: bus.busName,
          busNumber: bus.busNumber,
          totalSeats: bus.totalSeats
        },
        segments,
        routes
      }
    });

  } catch (error) {
    console.error('❌ Get bus bookings by date error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
