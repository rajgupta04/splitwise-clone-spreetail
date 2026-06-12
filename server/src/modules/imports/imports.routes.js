const { Router } = require('express');
const importsController = require('./imports.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const upload = require('../../middleware/upload.middleware');
const { validate } = require('../../middleware/validation.middleware');
const {
  groupIdParamSchema, importIdParamSchema,
  decideItemSchema, listItemsSchema,
} = require('./imports.validation');

const router = Router();

router.use(authMiddleware);

// Group-scoped routes
router.post(
  '/groups/:groupId/imports',
  validate(groupIdParamSchema),
  upload.single('file'),
  importsController.upload
);
router.get(
  '/groups/:groupId/imports',
  validate(groupIdParamSchema),
  importsController.listByGroup
);

// Import-scoped routes
router.get('/imports/:importId', validate(importIdParamSchema), importsController.getById);
router.get('/imports/:importId/items', validate(listItemsSchema), importsController.getItems);
router.post(
  '/imports/:importId/items/:itemId/decide',
  validate(decideItemSchema),
  importsController.decideItem
);
router.post(
  '/imports/:importId/finalize',
  validate(importIdParamSchema),
  importsController.finalize
);

// Decision log & report routes
router.get(
  '/imports/:importId/decisions',
  validate(importIdParamSchema),
  importsController.getDecisions
);
router.get(
  '/imports/:importId/report',
  validate(importIdParamSchema),
  importsController.getReport
);

module.exports = router;
