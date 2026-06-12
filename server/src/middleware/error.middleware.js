const ApiResponse = require('../utils/apiResponse');

/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a standardized response.
 * Must be registered LAST in the middleware chain.
 */
function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err);

  // Prisma known errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.join(', ') || 'field';
    return ApiResponse.badRequest(res, `A record with this ${field} already exists.`);
  }

  if (err.code === 'P2025') {
    return ApiResponse.notFound(res, 'The requested record was not found.');
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return ApiResponse.badRequest(res, 'Validation failed', errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token has expired');
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return ApiResponse.badRequest(res, 'File size exceeds the allowed limit');
  }

  // Custom application errors with statusCode
  if (err.statusCode) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  // Default: 500 Internal Server Error
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return ApiResponse.error(res, message, 500);
}

module.exports = errorHandler;
