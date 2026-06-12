const { Router } = require('express');
const membershipsController = require('./memberships.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validation.middleware');
const { addMemberSchema, removeMemberSchema, groupIdParamSchema } = require('./memberships.validation');

const router = Router();

router.use(authMiddleware);

router.post('/:groupId/members', validate(addMemberSchema), membershipsController.addMember);
router.delete('/:groupId/members/:userId', validate(removeMemberSchema), membershipsController.removeMember);
router.get('/:groupId/members', validate(groupIdParamSchema), membershipsController.getActiveMembers);
router.get('/:groupId/members/history', validate(groupIdParamSchema), membershipsController.getMembershipHistory);

module.exports = router;
