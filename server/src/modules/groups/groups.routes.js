const { Router } = require('express');
const groupsController = require('./groups.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { createGroupSchema, updateGroupSchema, groupIdParamSchema } = require('./groups.validation');

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.post('/', validate(createGroupSchema), groupsController.create);
router.post('/mock', groupsController.createMockGroup);
router.get('/', groupsController.list);
router.get('/:groupId', validate(groupIdParamSchema), groupsController.getById);
router.put('/:groupId', validate(updateGroupSchema), groupsController.update);
router.delete('/:groupId', validate(groupIdParamSchema), groupsController.archive);

module.exports = router;
