const { Router } = require('express');
const balancesController = require('./balances.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const z = require('zod');

const router = Router();

router.use(authMiddleware);

router.get(
  '/groups/:groupId/balances',
  validate({ params: z.object({ groupId: z.string().uuid() }) }),
  balancesController.getGroupBalances
);

router.get('/balances/me', balancesController.getUserBalanceSummary);

module.exports = router;
