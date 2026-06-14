const importsService = require('./imports.service');
const ApiResponse = require('../../utils/apiResponse');

const importsController = {
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return ApiResponse.badRequest(res, 'No CSV file provided.');
      }
      const csvImport = await importsService.uploadCsv(
        req.params.groupId,
        req.user.id,
        req.file
      );
      return ApiResponse.created(res, { import: csvImport }, 'CSV uploaded successfully');
    } catch (error) {
      return next(error);
    }
  },

  async listByGroup(req, res, next) {
    try {
      const imports = await importsService.getGroupImports(
        req.params.groupId,
        req.user.id
      );
      return ApiResponse.success(res, { imports });
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const csvImport = await importsService.getImportById(
        req.params.importId,
        req.user.id
      );
      return ApiResponse.success(res, { import: csvImport });
    } catch (error) {
      return next(error);
    }
  },

  async getItems(req, res, next) {
    try {
      const items = await importsService.getImportItems(
        req.params.importId,
        req.user.id,
        { status: req.query.status }
      );
      return ApiResponse.success(res, { items });
    } catch (error) {
      return next(error);
    }
  },

  async decideItem(req, res, next) {
    try {
      const decision = await importsService.decideItem(
        req.params.importId,
        req.params.itemId,
        req.user.id,
        req.body
      );
      return ApiResponse.success(res, { decision }, 'Decision recorded');
    } catch (error) {
      return next(error);
    }
  },

  async resolveItem(req, res, next) {
    try {
      const item = await importsService.resolveItem(
        req.params.importId,
        req.params.itemId,
        req.user.id,
        req.body
      );
      return ApiResponse.success(res, { item }, 'Anomaly resolved');
    } catch (error) {
      return next(error);
    }
  },

  async executeImport(req, res, next) {
    try {
      const result = await importsService.executeImport(
        req.params.importId,
        req.user.id
      );
      return ApiResponse.success(res, { result }, 'Import executed');
    } catch (error) {
      return next(error);
    }
  },

  async finalize(req, res, next) {
    try {
      const result = await importsService.finalizeImport(
        req.params.importId,
        req.user.id
      );
      return ApiResponse.success(res, { result }, 'Import finalized');
    } catch (error) {
      return next(error);
    }
  },

  async getDecisions(req, res, next) {
    try {
      const decisions = await importsService.getImportDecisions(
        req.params.importId,
        req.user.id
      );
      return ApiResponse.success(res, { decisions });
    } catch (error) {
      return next(error);
    }
  },

  async getReport(req, res, next) {
    try {
      const report = await importsService.generateReport(
        req.params.importId,
        req.user.id
      );
      return ApiResponse.success(res, { report });
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = importsController;
