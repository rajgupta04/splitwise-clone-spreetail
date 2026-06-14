const { Router } = require('express');
const authController = require('./auth.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { registerSchema, loginSchema } = require('./auth.validation');

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);

// Protected routes
router.get('/me', authMiddleware, authController.getProfile);
router.put('/me/currency', authMiddleware, authController.updateCurrency);

module.exports = router;
