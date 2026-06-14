// ==================== controllers/yatraController.js ====================
const YatraPackage = require('../models/YatraPackage');
const YatraBooking = require('../models/YatraBooking');
const Bus = require('../models/Bus');
const Wallet = require('../models/Wallet');
const walletController = require('./walletController');
const fs = require('fs');
const path = require('path');

// ============================================================
// OWNER APIS
// ============================================================

/**
 * POST /yatra/owner/packages/upload-images
 * Upload images for a yatra package
 */
exports.uploadYatraImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const backupDir = path.join(__dirname, '../../../backups/yatra_images');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filePaths = [];
    
    for (const file of req.files) {
      // file path in the local server uploads dir (Multer will save it there based on config in route)
      const localUrlPath = `/uploads/yatra/${file.filename}`;
      filePaths.push(localUrlPath);

      // Copy to backup dir
      const backupFilePath = path.join(backupDir, file.filename);
      fs.copyFileSync(file.path, backupFilePath);
    }

    res.status(200).json({ success: true, data: filePaths, message: 'Images uploaded and backed up successfully' });
  } catch (error) {
    console.error('Yatra image upload error:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
};

/**  
 * POST /yatra/owner/packages
 * Create a new Yatra package
 */
exports.createPackage = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const {
      busId, title, description, category, highlights,
      startDate, endDate, departurePoint, destinationCity, itinerary,
      inclusions, exclusions, pricePerPerson, totalSeats,
      contactPhone, images, pickupPoints
    } = req.body;

    // Validate bus ownership
    const bus = await Bus.findOne({ _id: busId, ownerId });
    if (!bus) {
      return res.status(403).json({ success: false, message: 'Bus not found or not authorized' });
    }

    if (!title || !startDate || !endDate || !pricePerPerson || !totalSeats || !destinationCity) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }

    const pkg = new YatraPackage({
      ownerId,
      busId,
      title,
      description,
      category: category || 'religious',
      highlights: highlights || [],
      startDate,
      endDate,
      departurePoint,
      pickupPoints: pickupPoints || [],
      itinerary: itinerary || [],
      inclusions: inclusions || [],
      exclusions: exclusions || [],
      pricePerPerson,
      totalSeats,
      destinationCity,
      contactPhone,
      images: images || [],
      status: req.body.status || 'draft'
    });

    await pkg.save();
    res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    console.error('Create Yatra package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /yatra/owner/packages
 * List all packages belonging to the owner
 */
exports.getOwnerPackages = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const packages = await YatraPackage.find({ ownerId })
      .populate('busId', 'busNumber busType')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /yatra/owner/packages/:id
 * Update a package (only if draft or active)
 */
exports.updatePackage = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const pkg = await YatraPackage.findOne({ _id: req.params.id, ownerId });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    if (['completed', 'cancelled'].includes(pkg.status)) {
      return res.status(400).json({ success: false, message: 'Cannot edit a completed or cancelled package' });
    }

    const allowed = [
      'busId', 'title', 'description', 'highlights', 'startDate', 'endDate',
      'departurePoint', 'pickupPoints', 'destinationCity', 'itinerary', 'inclusions', 'exclusions', 
      'pricePerPerson', 'totalSeats', 'contactPhone', 'images', 'status', 'category'
    ];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        pkg[field] = req.body[field];
      }
    });

    await pkg.save();
    res.json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /yatra/owner/packages/:id
 * Delete only draft packages
 */
exports.deletePackage = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const pkg = await YatraPackage.findOne({ _id: req.params.id, ownerId });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    if (pkg.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft packages can be deleted. Cancel it first.' });
    }

    await YatraPackage.findByIdAndDelete(pkg._id);
    res.json({ success: true, message: 'Package deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /yatra/owner/packages/:id/bookings
 * See all bookings for a specific package
 */
exports.getPackageBookings = async (req, res) => {
  try {
    const ownerId = req.user.id;
    const pkg = await YatraPackage.findOne({ _id: req.params.id, ownerId });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

    const bookings = await YatraBooking.find({ packageId: pkg._id })
      .populate('customerId', 'name phone email')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// CUSTOMER APIS
// ============================================================

/**
 * GET /yatra/packages
 * Browse all active Yatra packages
 */
exports.listPackages = async (req, res) => {
  try {
    const { category, city } = req.query;

    const query = { status: 'active' };

    if (category) {
      query.category = category;
    }

    if (city) {
      query['departurePoint.city'] = { $regex: city, $options: 'i' };
    }

    const packages = await YatraPackage.find(query)
      .populate('busId', 'busNumber busType amenities')
      .populate('ownerId', 'name phone')
      .sort({ startDate: 1 });

    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /yatra/packages/:id
 * Full details of a single Yatra package
 */
exports.getPackageDetails = async (req, res) => {
  try {
    const pkg = await YatraPackage.findById(req.params.id)
      .populate('busId', 'busNumber busType amenities totalSeats')
      .populate('ownerId', 'name phone');

    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    if (!['active', 'full'].includes(pkg.status)) {
      return res.status(404).json({ success: false, message: 'Package not available' });
    }

    res.json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /yatra/book
 * Customer books seats in a Yatra
 */
exports.bookPackage = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { packageId, passengers, mealPreference, specialRequests } = req.body;

    if (!packageId || !passengers || passengers.length === 0) {
      return res.status(400).json({ success: false, message: 'packageId and passengers are required' });
    }

    // Load and validate package
    const pkg = await YatraPackage.findById(packageId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    if (pkg.status !== 'active') {
      return res.status(400).json({ success: false, message: `Package is ${pkg.status}, cannot book` });
    }

    const seatsRequested = passengers.length;
    if (pkg.bookedSeats + seatsRequested > pkg.totalSeats) {
      return res.status(400).json({
        success: false,
        message: `Only ${pkg.totalSeats - pkg.bookedSeats} seat(s) available`
      });
    }

    const totalAmount = pkg.pricePerPerson * seatsRequested;

    // Generate boarding OTP
    const boardingOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Create booking record first (to get the _id)
    const booking = new YatraBooking({
      packageId,
      customerId,
      passengers,
      seatsBooked: seatsRequested,
      pricePerPerson: pkg.pricePerPerson,
      totalAmount,
      mealPreference: mealPreference || 'veg',
      specialRequests,
      boardingOtp,
      status: 'confirmed',
      paymentStatus: 'pending'
    });

    // Deduct from wallet
    try {
      await walletController.deductMoney(customerId, totalAmount, {
        purpose: 'yatra_booking',
        bookingId: booking._id.toString(),
        description: `Yatra booking: ${pkg.title} (${seatsRequested} seat${seatsRequested > 1 ? 's' : ''})`
      });
      booking.paymentStatus = 'paid';
      booking.transactionId = `YTR_${booking._id.toString().slice(-8).toUpperCase()}`;
    } catch (payErr) {
      return res.status(400).json({ success: false, message: 'Payment failed: ' + payErr.message });
    }

    await booking.save();

    // Update package seat count
    pkg.bookedSeats += seatsRequested;
    pkg.totalRevenue = (pkg.totalRevenue || 0) + totalAmount;
    await pkg.save();

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Yatra booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /yatra/my-bookings
 * Customer's own Yatra bookings
 */
exports.getMyBookings = async (req, res) => {
  try {
    const customerId = req.user.id;
    const bookings = await YatraBooking.find({ customerId })
      .populate('packageId', 'title startDate endDate departurePoint category pricePerPerson status images')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /yatra/bookings/:id
 * Get single booking details
 */
exports.getBookingDetails = async (req, res) => {
  try {
    const booking = await YatraBooking.findOne({
      _id: req.params.id,
      customerId: req.user.id
    }).populate('packageId');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /yatra/bookings/:id/cancel
 * Customer cancels their Yatra booking
 */
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await YatraBooking.findOne({
      _id: req.params.id,
      customerId: req.user.id
    }).populate('packageId');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Already cancelled' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed trip' });
    }

    const pkg = booking.packageId;
    const now = new Date();
    const startDate = new Date(pkg.startDate);
    const daysUntilStart = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));

    // Refund policy
    let refundAmount = 0;
    if (daysUntilStart >= 7) {
      refundAmount = booking.totalAmount; // 100% refund
    } else if (daysUntilStart >= 3) {
      refundAmount = booking.totalAmount * 0.5; // 50% refund
    } else {
      refundAmount = 0; // No refund within 3 days
    }

    // Process refund
    if (refundAmount > 0 && booking.paymentStatus === 'paid') {
      try {
        await Wallet.atomicCredit(booking.customerId, refundAmount, {
          transactionId: `REFUND_YTR_${booking._id.toString().slice(-8)}`,
          source: 'money_added',
          description: `Refund for cancelled Yatra: ${pkg.title}`
        });
        booking.paymentStatus = 'refunded';
      } catch (e) {
        console.error('Refund failed:', e);
      }
    }

    booking.status = 'cancelled';
    booking.cancellationDate = now;
    booking.cancellationReason = req.body.reason || 'Customer cancelled';
    booking.refundAmount = refundAmount;

    await booking.save();

    // Free up seats in package
    const yatraPkg = await YatraPackage.findById(booking.packageId._id || booking.packageId);
    if (yatraPkg) {
      yatraPkg.bookedSeats = Math.max(0, yatraPkg.bookedSeats - booking.seatsBooked);
      if (yatraPkg.status === 'full') yatraPkg.status = 'active';
      await yatraPkg.save();
    }

    res.json({
      success: true,
      data: booking,
      refundAmount,
      message: refundAmount > 0
        ? `Booking cancelled. ₹${refundAmount} refunded to your wallet.`
        : 'Booking cancelled. No refund applicable (within 3 days of trip).'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
