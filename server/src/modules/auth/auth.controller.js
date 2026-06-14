const authService = require('./auth.service');
const ApiResponse = require('../../utils/apiResponse');

/**
 * Auth controller — handles HTTP request/response for authentication.
 */
const authController = {
  /**
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const { user, token } = await authService.register(req.body);
      return ApiResponse.created(res, { user, token }, 'Registration successful');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { user, token } = await authService.login(req.body);
      return ApiResponse.success(res, { user, token }, 'Login successful');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST /api/auth/demo
   */
  async demoLogin(req, res, next) {
    try {
      const { accounts } = await authService.demoLogin();
      return ApiResponse.success(res, { accounts }, 'Demo login successful');
    } catch (error) {
      return next(error);
    }
  },

  /**
   * GET /api/auth/me
   */
  async getProfile(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      return ApiResponse.success(res, { user });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * PUT /api/auth/me/currency
   */
  async updateCurrency(req, res, next) {
    try {
      const user = await authService.updateCurrency(req.user.id, req.body.currency);
      return ApiResponse.success(res, { user }, 'Currency updated successfully');
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = authController;
