const z = require('zod');
const { SPLIT_TYPES } = require('../../config/constants');

const participantSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  amount: z.number().positive().optional(),      // For exact split
  percentage: z.number().min(0).max(100).optional(), // For percentage split
  shares: z.number().int().positive().optional(),     // For shares split
});

const createExpenseSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
  body: z.object({
    paidById: z.string().uuid('Invalid payer ID'),
    description: z.string().min(1, 'Description is required').max(300),
    originalAmount: z.number().positive('Amount must be positive'),
    originalCurrency: z.string().length(3, 'Currency code must be 3 characters'),
    exchangeRate: z.number().positive('Exchange rate must be positive').default(1.0),
    splitType: z.enum([SPLIT_TYPES.EQUAL, SPLIT_TYPES.EXACT, SPLIT_TYPES.PERCENTAGE, SPLIT_TYPES.SHARES]),
    expenseDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
    participants: z.array(participantSchema).min(1, 'At least one participant is required'),
  }),
};

const updateExpenseSchema = {
  params: z.object({
    expenseId: z.string().uuid('Invalid expense ID'),
  }),
  body: createExpenseSchema.body,
};

const expenseIdParamSchema = {
  params: z.object({
    expenseId: z.string().uuid('Invalid expense ID'),
  }),
};

const listExpensesSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
};

module.exports = { createExpenseSchema, updateExpenseSchema, expenseIdParamSchema, listExpensesSchema };
