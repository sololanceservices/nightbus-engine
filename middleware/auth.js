// ==================== middleware/auth.js ====================
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = await User.findById(decoded.id);
    req.userId = decoded.id;
    req.userRole = req.user?.role;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Not authorized, token failed'
    });
  }
};

// Alias for protect
exports.verifyToken = exports.protect;

// Optional protection (sets req.user if token is present, but doesn't fail if not)
exports.optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = await User.findById(decoded.id);
      req.userId = decoded.id;
    }
    next();
  } catch (error) {
    // Just proceed without user
    next();
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
};

// Check user role and optional admin sub-role
exports.checkRole = (allowedRoles, allowedAdminSubRoles = []) => {
  return (req, res, next) => {
    // 1. Transform to arrays if strings
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const adminSubRolesArray = Array.isArray(allowedAdminSubRoles) ? allowedAdminSubRoles : [allowedAdminSubRoles];

    // 2. Base role check
    if (!rolesArray.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Incorrect role.'
      });
    }

    // 3. Admin-specific sub-role check (if roles includes 'admin')
    // If the user is an admin, and we have sub-role restrictions
    if (req.userRole === 'admin' && adminSubRolesArray.length > 0) {
      const userAdminRole = req.user?.adminRole || 'super'; // Default to super if not set
      
      // Super admins always have access
      if (userAdminRole !== 'super' && !adminSubRolesArray.includes(userAdminRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Requires one of these admin roles: ${adminSubRolesArray.join(', ')}`
        });
      }
    }

    next();
  };
};

// Check if user is owner of resource
exports.checkOwnership = (Model, paramId = 'id') => {
  return async (req, res, next) => {
    try {
      const resource = await Model.findById(req.params[paramId]);

      if (!resource) {
        return res.status(404).json({ success: false, message: 'Resource not found' });
      }

      if (resource.userId?.toString() !== req.userId && req.userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      req.resource = resource;
      next();
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
};
