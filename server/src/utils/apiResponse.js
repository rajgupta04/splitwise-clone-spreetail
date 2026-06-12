/**
 * Standardized API response utility.
 * Ensures consistent response format across all endpoints.
 */

class ApiResponse {
  /**
   * Success response
   * @param {object} res - Express response object
   * @param {object} data - Response payload
   * @param {string} message - Human-readable message
   * @param {number} statusCode - HTTP status code (default 200)
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * Created response (201)
   */
  static created(res, data = null, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  /**
   * Error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default 500)
   * @param {object} errors - Validation errors or additional details
   */
  static error(res, message = 'Internal server error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
    };

    if (errors) {
      response.errors = errors;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Not found response (404)
   */
  static notFound(res, message = 'Resource not found') {
    return ApiResponse.error(res, message, 404);
  }

  /**
   * Unauthorized response (401)
   */
  static unauthorized(res, message = 'Unauthorized') {
    return ApiResponse.error(res, message, 401);
  }

  /**
   * Forbidden response (403)
   */
  static forbidden(res, message = 'Forbidden') {
    return ApiResponse.error(res, message, 403);
  }

  /**
   * Bad request response (400)
   */
  static badRequest(res, message = 'Bad request', errors = null) {
    return ApiResponse.error(res, message, 400, errors);
  }

  /**
   * Paginated response
   * @param {object} res - Express response object
   * @param {Array} data - Array of items
   * @param {number} total - Total count of items
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   */
  static paginated(res, data, total, page, limit) {
    return res.status(200).json({
      success: true,
      message: 'Success',
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  }
}

module.exports = ApiResponse;
