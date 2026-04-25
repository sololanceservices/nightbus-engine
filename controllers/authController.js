// ==================== controllers/authController.js ====================
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendNotification } = require('../utils/notifications');
const emailService = require('../utils/emailService');
const otpStore = {}; // Simple in-memory OTP store
const emailOtpStore = {}; // In-memory store for email OTPs

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '30d' });
};

// Send Phone OTP
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP
    otpStore[phone] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    // TODO: Send OTP via SMS
    console.log(`📱 Phone OTP for ${phone}: ${otp}`);

    res.status(200).json({ success: true, message: 'OTP sent successfully', otp });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send Email OTP
exports.sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP
    emailOtpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    // Send via email service
    await emailService.sendOTP(email, otp);

    res.status(200).json({ success: true, message: 'OTP sent to email successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Email OTP (Standalone verification for registration flow)
exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const storedOTP = emailOtpStore[email];
    const isValid = storedOTP && storedOTP.otp === otp && storedOTP.expiresAt > Date.now();

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark as verified in store (used later during registration)
    emailOtpStore[email].verified = true;

    res.status(200).json({ success: true, message: 'Email verified successfully' });
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
    const { phone, name, email, password, role = 'customer', fcmToken } = req.body;

    if (!phone || !name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields (name, email, phone, password) are required' });
    }

    // Verify email was pre-verified with OTP
    const storedEmailOTP = emailOtpStore[email];
    if (!storedEmailOTP || !storedEmailOTP.verified) {
      return res.status(400).json({ success: false, message: 'Email not verified. Please verify OTP first.' });
    }

    let user = await User.findOne({ $or: [{ phone }, { email }] });
    if (user) {
      return res.status(400).json({ success: false, message: 'User with this phone or email already exists' });
    }

    user = new User({ 
      phone, 
      name, 
      email, 
      password, 
      role, 
      isVerified: true, 
      fcmToken 
    });
    
    if (fcmToken) user.fcmTokens = [fcmToken];
    await user.save();

    // Cleanup store
    delete emailOtpStore[email];

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
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

// Login
exports.login = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Handle Password Login
    if (password) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } 
    // Handle OTP Login
    else if (otp) {
      const storedOTP = emailOtpStore[email];
      const isValid = storedOTP && storedOTP.otp === otp && storedOTP.expiresAt > Date.now();
      
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
      }
      
      // Cleanup
      delete emailOtpStore[email];
    } 
    else {
      return res.status(400).json({ success: false, message: 'Password or OTP is required' });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
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
