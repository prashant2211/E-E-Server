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
  const totalRecords = Number(pagination.total) || 0;
  const pageSize = Number(pagination.pageSize) || 10;
  const page = Number(pagination.page) || 1;
  const totalPages = pageSize > 0 ? Math.ceil(totalRecords / pageSize) : 0;

  return res.status(200).json({
    success: true,
    message,
    code: 200,
    data,
    // Root-level total for legacy/admin UIs (e.g. Teacher list pattern)
    totalRecords,
    pagination: {
      currentPage: page,
      pageSize,
      totalRecords,
      total: totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};

