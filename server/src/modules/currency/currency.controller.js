const currencyService = require('./currency.service');
const ApiResponse = require('../../utils/apiResponse');

const currencyController = {
  async getRate(req, res, next) {
    try {
      const { from, to, date } = req.query;

      if (!from || !to) {
        const error = new Error('Missing required query parameters: from, to');
        error.statusCode = 400;
        throw error;
      }

      const rate = await currencyService.getExchangeRate(from, to, date || 'latest');
      return ApiResponse.success(res, { rate }, 'Exchange rate fetched successfully');
    } catch (error) {
      return next(error);
    }
  }
};

module.exports = currencyController;
