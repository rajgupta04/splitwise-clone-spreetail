const { Router } = require('express');
const settlementsController = require('./settlements.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { createSettlementSchema, groupIdParamSchema } = require('./settlements.validation');

const router = Router();

router.use(authMiddleware);

router.post('/:groupId/settlements', validate(createSettlementSchema), settlementsController.create);
router.get('/:groupId/settlements', validate(groupIdParamSchema), settlementsController.list);

module.exports = router;
