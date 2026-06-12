const z = require('zod');

const addMemberSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
};

const removeMemberSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
    userId: z.string().uuid('Invalid user ID'),
  }),
};

const groupIdParamSchema = {
  params: z.object({
    groupId: z.string().uuid('Invalid group ID'),
  }),
};

module.exports = { addMemberSchema, removeMemberSchema, groupIdParamSchema };
