const membershipsService = require('./memberships.service');
const ApiResponse = require('../../utils/apiResponse');

const membershipsController = {
  async addMember(req, res, next) {
    try {
      const membership = await membershipsService.addMember(
        req.params.groupId,
        req.body.email,
        req.user.id
      );
      return ApiResponse.created(res, { membership }, 'Member added successfully');
    } catch (error) {
      return next(error);
    }
  },

  async removeMember(req, res, next) {
    try {
      const membership = await membershipsService.removeMember(
        req.params.groupId,
        req.params.userId,
        req.user.id
      );
      return ApiResponse.success(res, { membership }, 'Member removed successfully');
    } catch (error) {
      return next(error);
    }
  },

  async getActiveMembers(req, res, next) {
    try {
      const members = await membershipsService.getActiveMembers(
        req.params.groupId,
        req.user.id
      );
      return ApiResponse.success(res, { members });
    } catch (error) {
      return next(error);
    }
  },

  async getMembershipHistory(req, res, next) {
    try {
      const history = await membershipsService.getMembershipHistory(
        req.params.groupId,
        req.user.id
      );
      return ApiResponse.success(res, { history });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = membershipsController;
