const z = require('zod');

const createGroupSchema = {
  body: z.object({
    name: z.string().min(1, 'Group name is required').max(100),
    description: z.string().max(500).optional(),
    baseCurrency: z.string().length(3, 'Currency code must be 3 characters').default('USD'),
  }),
};

const updateGroupSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    baseCurrency: z.string().length(3).optional(),
  }),
};

const groupIdParamSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
};

module.exports = { createGroupSchema, updateGroupSchema, groupIdParamSchema };
