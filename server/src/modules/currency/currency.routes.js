const express = require('express');
const currencyController = require('./currency.controller');
const authMiddleware = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/rate', currencyController.getRate);

module.exports = router;
