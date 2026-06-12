const z = require('zod');

const createSettlementSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
  body: z.object({
    payerId: z.string().uuid('Invalid payer ID'),
    payeeId: z.string().uuid('Invalid payee ID'),
    originalAmount: z.number().positive('Amount must be positive'),
    originalCurrency: z.string().length(3, 'Currency code must be 3 characters'),
    exchangeRate: z.number().positive('Exchange rate must be positive').default(1.0),
  }),
};

const groupIdParamSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
};

module.exports = { createSettlementSchema, groupIdParamSchema };
