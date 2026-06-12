const settlementsService = require('./settlements.service');
const ApiResponse = require('../../utils/apiResponse');

const settlementsController = {
  async create(req, res, next) {
    try {
      const settlement = await settlementsService.createSettlement({
        ...req.body,
        groupId: req.params.groupId,
        userId: req.user.id,
      });
      return ApiResponse.created(res, { settlement }, 'Settlement recorded successfully');
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      const settlements = await settlementsService.getGroupSettlements(
        req.params.groupId,
        req.user.id
      );
      return ApiResponse.success(res, { settlements });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = settlementsController;
