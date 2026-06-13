const expensesService = require('./expenses.service');
const ApiResponse = require('../../utils/apiResponse');

const expensesController = {
  async create(req, res, next) {
    try {
      const expense = await expensesService.createExpense({
        ...req.body,
        groupId: req.params.groupId,
        userId: req.user.id,
      });
      return ApiResponse.created(res, { expense }, 'Expense created successfully');
    } catch (error) {
      return next(error);
    }
  },

  async list(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const { expenses, total } = await expensesService.getGroupExpenses(
        req.params.groupId,
        req.user.id,
        { page, limit }
      );
      return ApiResponse.paginated(res, expenses, total, page, limit);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const expense = await expensesService.getExpenseById(req.params.expenseId, req.user.id);
      return ApiResponse.success(res, { expense });
    } catch (error) {
      return next(error);
    }
  },

  async update(req, res, next) {
    try {
      const expense = await expensesService.updateExpense(
        req.params.expenseId,
        req.body,
        req.user.id
      );
      return ApiResponse.success(res, { expense }, 'Expense updated successfully');
    } catch (error) {
      return next(error);
    }
  },

  async remove(req, res, next) {
    try {
      await expensesService.deleteExpense(req.params.expenseId, req.user.id);
      return ApiResponse.success(res, null, 'Expense deleted successfully');
    } catch (error) {
      return next(error);
    }
  },
};

module.exports = expensesController;
