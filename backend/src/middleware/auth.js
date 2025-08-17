// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

/**
 * Simple authentication middleware
 * In production, replace with proper authentication system
 */
const authenticate = async (req, res, next) => {
  try {
    // Skip authentication in development
    if (process.env.NODE_ENV === 'development' && !process.env.REQUIRE_AUTH) {
      req.user = {
        id: 'dev-user',
        name: 'Development User',
        role: 'admin'
      };
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = await promisify(jwt.verify)(token, secret);
    
    req.user = {
      id: decoded.sub,
      name: decoded.name,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional authentication - proceeds even without token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = await promisify(jwt.verify)(token, secret);
      
      req.user = {
        id: decoded.sub,
        name: decoded.name,
        role: decoded.role || 'user'
      };
    }

    next();
  } catch (error) {
    // Proceed without user info if token is invalid
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};