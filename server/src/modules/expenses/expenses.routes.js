const { Router } = require('express');
const expensesController = require('./expenses.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const {
  createExpenseSchema, updateExpenseSchema,
  expenseIdParamSchema, listExpensesSchema,
} = require('./expenses.validation');

const router = Router();

router.use(authMiddleware);

// Group-scoped routes
router.post('/groups/:groupId/expenses', validate(createExpenseSchema), expensesController.create);
router.get('/groups/:groupId/expenses', validate(listExpensesSchema), expensesController.list);

// Expense-scoped routes
router.get('/expenses/:expenseId', validate(expenseIdParamSchema), expensesController.getById);
router.put('/expenses/:expenseId', validate(updateExpenseSchema), expensesController.update);
router.delete('/expenses/:expenseId', validate(expenseIdParamSchema), expensesController.remove);

module.exports = router;
