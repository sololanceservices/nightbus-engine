// ==================== controllers/authController.js ====================
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendNotification } = require('../utils/notifications');
const otpStore = {}; // Simple in-memory OTP store

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '30d' });
};

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP (in production, use Redis or database)
    otpStore[phone] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    // TODO: Send OTP via SMS (Twilio, AWS SNS, etc.)
    console.log(`📱 OTP for ${phone}: ${otp}`);

    res.status(200).json({ success: true, message: 'OTP sent successfully', otp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP and handle existing/new users
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp, role = 'customer', name, email, fcmToken } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    // For testing: accept any 6-digit OTP
    const isValidOTP = /^\d{6}$/.test(otp);
    if (!isValidOTP) {
      return res.status(400).json({ success: false, message: 'OTP must be 6 digits' });
    }

    // Check OTP (in testing/dev, any valid 6-digit is accepted; in production verify against otpStore)
    const storedOTP = otpStore[phone];
    const otpValid = process.env.NODE_ENV === 'production'
      ? (storedOTP && storedOTP.otp === otp && storedOTP.expiresAt > Date.now())
      : isValidOTP; // Allow any 6-digit for testing

    if (!otpValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Find or create user
    let user = await User.findOne({ phone });
    if (!user) {
      // New user - use provided role or default to customer
      const validRoles = ['customer', 'owner', 'staff', 'vendor', 'admin'];
      const userRole = validRoles.includes(role) ? role : 'customer';

      user = new User({
        phone,
        name: name || phone,
        email,
        isVerified: true,
        role: userRole,
        fcmToken // Store for push notifications
      });
      if (fcmToken) user.fcmTokens = [fcmToken];
      await user.save();
      console.log(`✅ New user created: ${user.name} (${user.role})`);
    } else {
      // Existing user - update verification status and optional role
      user.isVerified = true;
      if (name) user.name = name;
      if (email) user.email = email;
      if (role && ['customer', 'owner', 'staff', 'vendor', 'admin'].includes(role)) {
        user.role = role;
      }

      // Update FCM token if provided
      if (fcmToken) {
        user.fcmToken = fcmToken;
        if (!user.fcmTokens) user.fcmTokens = [];
        if (!user.fcmTokens.includes(fcmToken)) {
          user.fcmTokens.push(fcmToken);
        }
      }

      await user.save();
      console.log(`✅ User verified: ${user.name} (${user.role})`);
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Clear OTP
    delete otpStore[phone];

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isServiceProvider: user.isServiceProvider,
        serviceType: user.serviceType,
        isFoodVendor: user.isFoodVendor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Register
exports.register = async (req, res) => {
  try {
    const { phone, name, email, role = 'customer', fcmToken } = req.body;

    if (!phone || !name) {
      return res.status(400).json({ success: false, message: 'Phone and name are required' });
    }

    let user = await User.findOne({ phone });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    user = new User({ phone, name, email, role, isVerified: true, fcmToken });
    if (fcmToken) user.fcmTokens = [fcmToken];
    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isServiceProvider: user.isServiceProvider,
        serviceType: user.serviceType,
        isFoodVendor: user.isFoodVendor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login (Password based for staff)
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required' });
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user || user.role !== 'staff') {
      return res.status(401).json({ success: false, message: 'Invalid credentials or not a staff member' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        staffRole: user.staffRole,
        isServiceProvider: user.isServiceProvider,
        serviceType: user.serviceType,
        isFoodVendor: user.isFoodVendor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isServiceProvider: user.isServiceProvider,
        serviceType: user.serviceType,
        isFoodVendor: user.isFoodVendor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email, age, gender, language, fcmToken } = req.body;

    const updateData = { name, email, age, gender, language };
    if (fcmToken) {
      updateData.fcmToken = fcmToken;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update fields
    Object.assign(user, updateData);

    // Specifically handle fcmTokens array
    if (fcmToken) {
      if (!user.fcmTokens) user.fcmTokens = [];
      if (!user.fcmTokens.includes(fcmToken)) {
        user.fcmTokens.push(fcmToken);
      }
    }

    await user.save();

    res.status(200).json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// TEMPORARY: Test Login (Bypass OTP for testing)
// ⚠️ REMOVE IN PRODUCTION - This is for temporary testing only
exports.testLogin = async (req, res) => {
  try {
    const { phone, role = 'customer' } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }

    // Validate role
    const validRoles = ['customer', 'owner', 'staff', 'vendor', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'customer';

    // Find or create user
    let user = await User.findOne({ phone });
    if (!user) {
      user = new User({
        phone,
        name: `Test ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`,
        role: userRole,
        isVerified: true
      });
      await user.save();
      console.log(`✅ Test user created: ${user.name} (${user.role})`);
    } else {
      // Update role if provided
      if (role && validRoles.includes(role)) {
        user.role = role;
        user.isVerified = true;
        await user.save();
      }
      console.log(`✅ Test user logged in: ${user.name} (${user.role})`);
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: `Login successful as ${user.role}`,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        isServiceProvider: user.isServiceProvider,
        serviceType: user.serviceType,
        isFoodVendor: user.isFoodVendor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update FCM Token
exports.updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.fcmToken = fcmToken;
    if (!user.fcmTokens) user.fcmTokens = [];
    if (!user.fcmTokens.includes(fcmToken)) {
      user.fcmTokens.push(fcmToken);
    }

    await user.save();

    // Send a welcome push notification to confirm it's working (Async)
    sendNotification(user._id, {
      title: 'Push Notifications Enabled ✅',
      body: 'Your device is ready to receive real-time updates from BusApp!',
      type: 'system',
      data: {
        message: 'Welcome back!'
      }
    }).catch(err => console.log('Login Notification error:', err));

    res.status(200).json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
