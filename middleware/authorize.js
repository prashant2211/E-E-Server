const { logger } = require('../utils/logger');
const normalizeRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

/**
 * Authorization middleware
 * Checks if user has required role/permission
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 401
      });
    }

    const userRole = req.user.UserType;
    const normalizedUserRole = normalizeRole(userRole);
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
      logger.warn('Authorization failed:', {
        user: req.user.Email,
        role: userRole,
        required: allowedRoles,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        code: 403
      });
    }

    next();
  };
};

/**
 * Super Admin only middleware
 */
const requireSuperAdmin = authorize('SuperAdmin');

module.exports = {
  authorize,
  requireSuperAdmin
};

