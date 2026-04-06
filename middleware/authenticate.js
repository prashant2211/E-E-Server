const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { getJwtAccessSecret } = require('../utils/jwtConfig');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
        code: 401
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
        code: 401
      });
    }

    const decoded = jwt.verify(token, getJwtAccessSecret());

    // Attach user to request
    req.user = decoded;

    // SuperAdmin can operate in selected institution context.
    const normalizedUserType = String(req.user?.UserType || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const targetInstitutionCode = String(req.headers['x-target-institution-code'] || '').trim();

    if (normalizedUserType === 'superadmin' && targetInstitutionCode) {
      req.user.InstutionCode = targetInstitutionCode;
      req.user.SelectedInstitutionCode = targetInstitutionCode;
    }

    next();
  } catch (error) {
    logger.warn('Authentication failed:', {
      error: error.message,
      url: req.originalUrl,
      ip: req.ip
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        code: 401
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        code: 401
      });
    }

    res.status(401).json({
      success: false,
      message: 'Authentication failed. Please login again.',
      code: 401
    });
  }
};

module.exports = authenticate;
