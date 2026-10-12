/**
 * Request validation middleware
 * Validates request body, params, and query
 */

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate({
      body: req.body,
      query: req.query,
      params: req.params
    }, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        code: 400,
        errors
      });
    }

    // Replace request data with validated and sanitized data
    req.body = value.body || req.body;
    req.query = value.query || req.query;
    req.params = value.params || req.params;

    next();
  };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.PageNumber) || 1;
  const pageSize = parseInt(req.query.PageSize) || 10;

  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: 'PageNumber must be greater than 0',
      code: 400
    });
  }

  if (pageSize < 1 || pageSize > 100) {
    return res.status(400).json({
      success: false,
      message: 'PageSize must be between 1 and 100',
      code: 400
    });
  }

  req.pagination = {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };

  next();
};

module.exports = {
  validate,
  validatePagination
};

