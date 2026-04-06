/**
 * Standardized API response helper
 * Ensures consistent response format across all endpoints
 */

/**
 * Success response
 */
const successResponse = (res, data, message = 'Operation successful', code = 200) => {
  return res.status(code).json({
    success: true,
    message,
    code,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Error response
 */
const errorResponse = (res, message = 'Operation failed', code = 400, errors = null) => {
  const response = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString()
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(code).json(response);
};

/**
 * Paginated response
 */
const paginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
  return res.status(200).json({
    success: true,
    message,
    code: 200,
    data,
    pagination: {
      currentPage: pagination.page,
      pageSize: pagination.pageSize,
      totalRecords: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
      hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.pageSize),
      hasPreviousPage: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};

