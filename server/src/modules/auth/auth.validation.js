const z = require('zod');

const registerSchema = {
  body: z.object({
    email: z.string().email('Invalid email address'),
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password is too long'),
  }),
};

const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
};

module.exports = { registerSchema, loginSchema };
