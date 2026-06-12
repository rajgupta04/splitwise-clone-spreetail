const ApiResponse = require('../utils/apiResponse');

/**
 * Request validation middleware factory.
 * Uses Zod schemas to validate request body, params, and query.
 *
 * Usage:
 *   const { validate } = require('../middleware/validation.middleware');
 *   router.post('/expenses', validate(createExpenseSchema), controller.create);
 *
 * @param {object} schema - Object with optional body, params, query Zod schemas
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      return next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return ApiResponse.badRequest(res, 'Validation failed', errors);
      }
      return next(error);
    }
  };
}

module.exports = { validate };
