const groupsService = require('./groups.service');
const ApiResponse = require('../../utils/apiResponse');

const groupsController = {
  async create(req, res, next) {
    try {
      const group = await groupsService.createGroup({
        ...req.body,
        userId: req.user.id,
      });
      return ApiResponse.created(res, { group }, 'Group created successfully');
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      const groups = await groupsService.getUserGroups(req.user.id);
      return ApiResponse.success(res, { groups });
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const group = await groupsService.getGroupById(req.params.groupId, req.user.id);
      return ApiResponse.success(res, { group });
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const group = await groupsService.updateGroup(
        req.params.groupId,
        req.user.id,
        req.body
      );
      return ApiResponse.success(res, { group }, 'Group updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  async archive(req, res, next) {
    try {
      await groupsService.archiveGroup(req.params.groupId, req.user.id);
      return ApiResponse.success(res, null, 'Group archived successfully');
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = groupsController;
