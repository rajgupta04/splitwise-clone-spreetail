const balancesService = require('./balances.service');
const ApiResponse = require('../../utils/apiResponse');

const balancesController = {
  async getGroupBalances(req, res, next) {
    try {
      const balances = await balancesService.getGroupBalances(
        req.params.groupId,
        req.user.id
      );
      return ApiResponse.success(res, { balances });
    } catch (error) {
      return next(error);
    }
  },

  async getUserBalanceSummary(req, res, next) {
    try {
      const summary = await balancesService.getUserBalanceSummary(req.user.id);
      return ApiResponse.success(res, { summary });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = balancesController;
