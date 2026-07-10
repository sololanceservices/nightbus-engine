// ==================== controllers/foodController.js ====================
const FoodVendor = require('../models/FoodVendor');
const FoodItem = require('../models/FoodItem');
const FoodOrder = require('../models/FoodOrder');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Journey = require('../models/Journey');
const Segment = require('../models/Segment');
const Route = require('../models/Route');
const walletController = require('./walletController');
const fs = require('fs');
const path = require('path');

// --- SMART ETA CONSTANTS ---
// We assume a fixed delivery buffer time of 5 mins for simplicity in the MVP
const DELIVERY_BUFFER_MINUTES = 5;

exports.getVendors = async (req, res) => {
  try {
    const { mode, lat, lng, journeyETA, city, fromRoute, toRoute, journeyId } = req.query;
    
    // Advanced matching query
    let query = {};
    
    // Match by serviceArea/city
    if (city) {
      query.$or = [
        { 'serviceAreas.city': { $regex: city, $options: 'i' } },
        { name: { $regex: city, $options: 'i' } } // Fallback for specific shop name search
      ];
    }

    let intermediateStops = [];
    if (journeyId) {
      try {
        const journey = await Journey.findById(journeyId).populate('segments');
        if (journey && journey.segments.length > 0) {
          const segment = await Segment.findById(journey.segments[0]._id).populate('routeId');
          if (segment && segment.routeId) {
            const route = segment.routeId;
            const fromStopName = segment.fromStop.name;
            const toStopName = segment.toStop.name;
            
            let fromIndex = route.stops.findIndex(s => s.name.toLowerCase() === fromStopName.toLowerCase());
            let toIndex = route.stops.findIndex(s => s.name.toLowerCase() === toStopName.toLowerCase());
            
            if (fromIndex !== -1 && toIndex !== -1) {
              if (fromIndex > toIndex) {
                 const temp = fromIndex;
                 fromIndex = toIndex;
                 toIndex = temp;
              }
              for (let i = fromIndex; i <= toIndex; i++) {
                intermediateStops.push(route.stops[i].name);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error extracting intermediate stops", err);
      }
    }

    if (intermediateStops.length > 0) {
       if (!query.$or) query.$or = [];
       const regexStops = intermediateStops.map(s => new RegExp(`^${s}$`, 'i'));
       query.$or.push({ 'serviceAreas.city': { $in: regexStops } });
       // Also allow if vendor name matches intermediate stop (fallback)
       query.$or.push({ name: { $in: regexStops } });
    }

    // Match by routes (if applicable)
    if (fromRoute && toRoute) {
      if (!query.$or) query.$or = [];
      query.$or.push({
        routes: { 
          $elemMatch: { 
            from: { $regex: fromRoute, $options: 'i' },
            to: { $regex: toRoute, $options: 'i' }
          }
        }
      });
    }

    let vendors = await FoodVendor.find(query);
    
    let result = [];
    for (const vendor of vendors) {
      const items = await FoodItem.find({ vendorId: vendor._id, isAvailable: true });
      
      let processedItems = items.map(item => {
        let isDeliverable = true;
        let rejectReason = null;
        
        // Time matching logic: Prep + Delivery + Buffer <= ETA
        if (mode === 'smart' && journeyETA) {
          const buffer = 8; // Increased buffer for production reliability
          const totalRequiredTime = (item.prepTime || 15) + (vendor.avgDeliveryTime || 15) + buffer;
          const etaNumber = Number(journeyETA);
          
          if (totalRequiredTime > etaNumber) {
            isDeliverable = false;
            rejectReason = `Delivery takes ~${totalRequiredTime}m, but bus arrives in ${etaNumber}m`;
          }
        }
        
        return {
          ...item.toObject(),
          isDeliverable,
          rejectReason,
          totalRequiredTime: mode === 'smart' ? (item.prepTime + (vendor.avgDeliveryTime || 15) + 5) : null
        };
      });

      // Show vendor only if it has deliverable items in smart mode?
      // For now, show all but mark individual items.
      result.push({
        vendor,
        items: processedItems
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching food vendors:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- VENDOR MANAGEMENT ---

exports.getFoodVendorProfile = async (req, res) => {
  try {
    const vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.registerFoodVendor = async (req, res) => {
  try {
    const { name, location, deliveryRadius, avgDeliveryTime, serviceAreas, routes, availableHours, fssaiNumber, gstNumber, bankName, bankAccountNumber, bankIfscCode, bankAccountHolderName, upiId } = req.body;
    
    // Mandatory verification check: at least one of FSSAI or GST must be provided
    if (!fssaiNumber && !gstNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification failed: Providing either a valid FSSAI License Number or GSTIN Number is mandatory.' 
      });
    }

    // Validate FSSAI License Number format (14 digits)
    if (fssaiNumber) {
      const fssaiPattern = /^[0-9]{14}$/;
      if (!fssaiPattern.test(fssaiNumber.trim())) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid FSSAI License Number. Must be exactly 14 digits.' 
        });
      }
    }

    // Validate GSTIN format (15-character alphanumeric Indian GST format)
    if (gstNumber) {
      const cleanGST = gstNumber.trim().toUpperCase();
      const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstPattern.test(cleanGST)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid GSTIN Number. Expected standard 15-character Indian GST format (e.g. 22AAAAA1111A1Z1).' 
        });
      }
    }

    let vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (vendor) {
      // Sync the flag just in case it was missing from the User record
      await User.findByIdAndUpdate(req.user.id, { isFoodVendor: true });
      return res.status(400).json({ success: false, message: 'Already a vendor' });
    }

    vendor = new FoodVendor({
      userId: req.user.id,
      name,
      location,
      deliveryRadius,
      avgDeliveryTime,
      serviceAreas,
      routes,
      availableHours,
      fssaiNumber: fssaiNumber ? fssaiNumber.trim() : undefined,
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : undefined,
      bankName: bankName ? bankName.trim() : undefined,
      bankAccountNumber: bankAccountNumber ? bankAccountNumber.trim() : undefined,
      bankIfscCode: bankIfscCode ? bankIfscCode.trim().toUpperCase() : undefined,
      bankAccountHolderName: bankAccountHolderName ? bankAccountHolderName.trim() : undefined,
      upiId: upiId ? upiId.trim() : undefined
    });

    await vendor.save();
    
    // Update user role if needed (assuming role exists)
    await User.findByIdAndUpdate(req.user.id, { isFoodVendor: true });

    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error registering vendor' });
  }
};

exports.updateFoodVendorProfile = async (req, res) => {
  try {
    const { 
      name, description, avgDeliveryTime, defaultPrepTime, isNightServiceActive, 
      serviceAreas, routes, availableHours,
      bankName, bankAccountNumber, bankIfscCode, bankAccountHolderName, upiId 
    } = req.body;
    
    const updateData = {
      name,
      description,
      avgDeliveryTime,
      defaultPrepTime,
      isNightServiceActive,
      serviceAreas,
      routes,
      availableHours,
      bankName: bankName !== undefined ? bankName.trim() : undefined,
      bankAccountNumber: bankAccountNumber !== undefined ? bankAccountNumber.trim() : undefined,
      bankIfscCode: bankIfscCode !== undefined ? bankIfscCode.trim().toUpperCase() : undefined,
      bankAccountHolderName: bankAccountHolderName !== undefined ? bankAccountHolderName.trim() : undefined,
      upiId: upiId !== undefined ? upiId.trim() : undefined
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    let vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) {
      vendor = new FoodVendor({
        userId: req.user.id,
        ...updateData
      });
      await vendor.save();
    } else {
      vendor = await FoodVendor.findOneAndUpdate(
        { userId: req.user.id },
        { $set: updateData },
        { new: true, runValidators: true }
      );
    }
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
};


exports.getVendorDashboardStats = async (req, res) => {
  try {
    const vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await FoodOrder.find({
      vendorId: vendor._id,
      createdAt: { $gte: today }
    });

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const todayEarnings = deliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const avgOrderValue = totalOrders > 0 ? (todayEarnings / (deliveredOrders.length || 1)) : 0;

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    const historicalOrders = await FoodOrder.find({
      vendorId: vendor._id,
      createdAt: { $gte: last7Days },
      status: 'delivered'
    });

    // Simple peak hour calculation
    let peakHourStr = "N/A";
    if (historicalOrders.length > 0) {
      const hours = historicalOrders.map(o => new Date(o.createdAt).getHours());
      const counts = hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
      const peakHour = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      const start = Number(peakHour);
      peakHourStr = `${start}:00 - ${start + 1}:00`;
    }

    // All-time stats
    const allOrders = await FoodOrder.find({ vendorId: vendor._id });
    const completed = allOrders.filter(o => o.status === 'delivered').length;
    const cancelled = allOrders.filter(o => o.status === 'rejected' || o.status === 'cancelled').length;
    const cancellationRate = allOrders.length > 0 ? Math.round((cancelled / allOrders.length) * 100) : 0;

    // Get Wallet Balance
    const wallet = await Wallet.findOne({ userId: req.user.id });
    const walletBalance = wallet ? wallet.balance : 0;

    res.status(200).json({
      success: true,
      data: {
        todayEarnings,
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue),
        peakTime: peakHourStr,
        walletBalance,
        performance: {
          rating: vendor.performance?.rating || 0,
          ordersCompleted: completed,
          cancellationRate: cancellationRate
        }
      }
    });
  } catch (error) {
    console.error('Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.toggleFoodVendorStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const vendor = await FoodVendor.findOneAndUpdate(
      { userId: req.user.id },
      { isActive },
      { new: true }
    );
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { vendorId, items, deliveryLocation, journeyId, orderMode, targetDeliveryTime, pnrNumber, paymentMethod } = req.body;
    
    let totalAmount = 0;
    const processedItems = items.map(i => {
      totalAmount += (i.price * i.quantity);
      return {
        itemId: i.itemId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        prepTime: i.prepTime
      };
    });

    // Generate random 4-digit OTP
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Create the order object first so we have an ID for the transaction
    const order = new FoodOrder({
      userId: req.user.id,
      vendorId,
      items: processedItems,
      totalAmount,
      deliveryLocation,
      journeyId,
      orderMode: orderMode || 'normal',
      targetDeliveryTime,
      deliveryOtp, // newly added
      pnrNumber, // mapped from request
      paymentStatus: 'pending'
    });

    // 1. Implicitly deposit money to wallet if paid via Card/UPI (invisible checkout)
    if (paymentMethod === 'card' || paymentMethod === 'upi') {
      try {
        const Wallet = require('../models/Wallet');
        await Wallet.atomicCredit(req.user.id, totalAmount, {
          transactionId: `FOOD_DEP_${order._id.toString()}`,
          source: 'money_added',
          description: `Online Payment Deposit (via ${paymentMethod.toUpperCase()})`
        });
      } catch (depError) {
        console.error('Implicit deposit failed:', depError.message);
        return res.status(400).json({
          success: false,
          message: 'Failed to process online checkout payment'
        });
      }
    }

    // 2. Attempt to deduct money from wallet
    try {
      await walletController.deductMoney(req.user.id, totalAmount, {
        purpose: 'food_booking',
        bookingId: order._id.toString(),
        description: `Food order payment (Vendor: ${vendorId})`
      });
      order.paymentStatus = 'paid'; // success
    } catch (paymentError) {
      console.error('Wallet deduction failed:', paymentError.message);
      return res.status(400).json({ 
        success: false, 
        message: 'Payment failed: ' + paymentError.message 
      });
    }

    // 2. Save the order only if payment succeeded
    await order.save();
    
    // 3. SET AUTO-REJECTION TIMEOUT (MVP Simulation)
    let timeoutMs = 10 * 60 * 1000; // 10 minutes default
    const isPreorder = order.orderMode === 'preorder' || 
                      (order.targetDeliveryTime && new Date(order.targetDeliveryTime).getTime() - Date.now() > 12 * 60 * 60 * 1000);
                      
    if (isPreorder) {
      timeoutMs = 12 * 60 * 60 * 1000; // 12 hours for preorders
    }

    setTimeout(async () => {
      try {
        const checkOrder = await FoodOrder.findById(order._id);
        if (checkOrder && checkOrder.status === 'pending') {
          console.log(`⏰ Auto-rejecting unresponsive order ${order._id}`);
          checkOrder.status = 'rejected';
          checkOrder.paymentStatus = 'refunded';
          await checkOrder.save();
          
          // Refund user wallet
          await Wallet.atomicCredit(order.userId, order.totalAmount, {
            transactionId: `AUTO_REFUND_${order._id}`,
            source: 'money_added',
            description: 'Refund: Vendor did not accept order in time'
          });
        }
      } catch (err) {
        console.error('Auto-rejection failure:', err);
      }
    }, timeoutMs);

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Error creating food order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, otp } = req.body;
    
    // Find order and populate vendor to get vendor's userId
    const order = await FoodOrder.findById(id).populate('vendorId', 'userId name');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    // Delivery OTP Check
    if (status === 'delivered') {
      if (!otp || String(otp) !== String(order.deliveryOtp)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing delivery OTP' });
      }

      // Settle funds to Vendor's Wallet
      if (order.paymentStatus === 'paid') {
        try {
          const transactionId = `SETTLE_${order._id.toString()}`;
          // Credit the vendor's wallet (vendorId.userId)
          await Wallet.atomicCredit(order.vendorId.userId, order.totalAmount, {
            transactionId,
            source: 'food_booking',
            description: `Settlement for food order ${order._id.toString().substring(0, 8)}`,
            metadata: {
              orderId: order._id.toString(),
              type: 'vendor_settlement'
            }
          });
          order.paymentStatus = 'settled';
        } catch (walletError) {
          console.error("Vendor settlement failed:", walletError);
          // Don't stop delivery success, but log it / handle it gracefully
        }
      }
    }

    order.status = status;
    if (status === 'rejected' || status === 'cancelled') {
       order.refundAmount = order.totalAmount;
       // Add logic to refund user's wallet here
       if (order.paymentStatus === 'paid') {
           try {
             await Wallet.atomicCredit(order.userId, order.totalAmount, {
                transactionId: `REFUND_${order._id.toString()}`,
                source: 'money_added',
                description: `Refund for cancelled food order`,
             });
             order.paymentStatus = 'refunded';
           } catch(e) {}
       }
    }
    
    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.cancelOrderUser = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await FoodOrder.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    if (order.status === 'delivered') return res.status(400).json({ success: false, message: 'Cannot cancel' });
    
    order.status = 'cancelled';
    order.cancellationFee = 50;
    order.refundAmount = Math.max(0, order.totalAmount - 50);
    
    // Process wallet refund
    if (order.paymentStatus === 'paid' && order.refundAmount > 0) {
        try {
          await Wallet.atomicCredit(order.userId, order.refundAmount, {
             transactionId: `REFUND_${order._id.toString()}`,
             source: 'money_added',
             description: `Refund for cancelled food order (minus fee)`,
          });
          order.paymentStatus = 'refunded';
        } catch(e) {
          console.error("Refund failed on user cancel", e);
        }
    }

    await order.save();
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.addVendorItem = async (req, res) => {
  try {
    const { name, description, price, prepTime, isVeg, images, category } = req.body;
    let vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Not a vendor' });

    const item = new FoodItem({
      vendorId: vendor._id,
      name,
      description,
      price,
      prepTime,
      isVeg,
      images,
      category: category || 'all'
    });
    
    await item.save();
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('❌ addVendorItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

exports.getVendorItems = async (req, res) => {
  try {
    let vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Not a vendor' });

    const items = await FoodItem.find({ vendorId: vendor._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateVendorItem = async (req, res) => {
  try {
    const { id } = req.params;
    let vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Not a vendor' });

    const item = await FoodItem.findOneAndUpdate(
      { _id: id, vendorId: vendor._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('❌ updateVendorItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

exports.deleteVendorItem = async (req, res) => {
  try {
    const { id } = req.params;
    let vendor = await FoodVendor.findOne({ userId: req.user.id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Not a vendor' });

    const item = await FoodItem.findOneAndDelete({ _id: id, vendorId: vendor._id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    
    res.status(200).json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('❌ deleteVendorItem error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

exports.getVendorOrders = async (req, res) => {
  try {
     const vendor = await FoodVendor.findOne({ userId: req.user.id });
     if (!vendor) return res.status(200).json({ success: true, data: [] });
     
     const orders = await FoodOrder.find({ vendorId: vendor._id })
       .populate('userId', 'name phone')
       .sort({ createdAt: -1 });
       
     res.status(200).json({ success: true, data: orders });
  } catch (error) {
     res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const orders = await FoodOrder.find({ userId: req.user.id })
      .populate('vendorId', 'name location')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getFoodOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await FoodOrder.findById(id).populate('vendorId', 'name location phone userId');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.uploadFoodImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const backupDir = path.join(__dirname, '../../../backups/food_images');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filePaths = [];
    
    for (const file of req.files) {
      // file path in the local server uploads dir (Multer will save it there based on config in route)
      const localUrlPath = `/uploads/food/${file.filename}`;
      filePaths.push(localUrlPath);

      // Copy to backup dir
      const backupFilePath = path.join(backupDir, file.filename);
      fs.copyFileSync(file.path, backupFilePath);
    }

    res.status(200).json({ success: true, data: filePaths, message: 'Images uploaded and backed up successfully' });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during upload' });
  }
};

