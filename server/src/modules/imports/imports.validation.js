const z = require('zod');

const groupIdParamSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
};

const importIdParamSchema = {
  params: z.object({
    importId: z.string().uuid('Invalid import ID'),
  }),
};

const decideItemSchema = {
  params: z.object({
    importId: z.string().uuid('Invalid import ID'),
    itemId: z.string().uuid('Invalid item ID'),
  }),
  body: z.object({
    decision: z.enum(['approve', 'reject'], { message: 'Decision must be "approve" or "reject"' }),
    reason: z.string().max(500).optional(),
  }),
};

const listItemsSchema = {
  params: z.object({
    importId: z.string().uuid('Invalid import ID'),
  }),
  query: z.object({
    status: z.enum(['pending', 'clean', 'flagged', 'approved', 'rejected', 'error']).optional(),
  }),
};

module.exports = { groupIdParamSchema, importIdParamSchema, decideItemSchema, listItemsSchema };
