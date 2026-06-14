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

const resolveItemSchema = {
  params: z.object({
    importId: z.string().uuid('Invalid import ID'),
    itemId: z.string().uuid('Invalid item ID'),
  }),
  body: z.object({
    resolutionType: z.string().min(1, 'resolutionType is required'),
    resolutionData: z.record(z.any()).optional().default({}),
  }),
};

const executeImportSchema = {
  params: z.object({
    importId: z.string().uuid('Invalid import ID'),
  }),
};

const listItemsSchema = {
  params: z.object({
    importId: z.string().uuid('Invalid import ID'),
  }),
  query: z.object({
    status: z.enum(['pending', 'clean', 'flagged', 'approved', 'rejected', 'error', 'resolved', 'skipped']).optional(),
  }),
};

module.exports = {
  groupIdParamSchema, importIdParamSchema, decideItemSchema,
  resolveItemSchema, executeImportSchema, listItemsSchema,
};
