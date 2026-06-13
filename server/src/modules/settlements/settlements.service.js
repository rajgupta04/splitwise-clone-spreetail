const prisma = require('../../config/database');
const settlementsRepository = require('./settlements.repository');
const { logActivity } = require('../../utils/activityLogger');
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require('../../config/constants');
const currencyService = require('../currency/currency.service');

const settlementsService = {
  /**
   * Record a settlement (payment) between two users in a group.
   */
  async createSettlement(data) {
    const {
      groupId, payerId, payeeId, originalAmount, originalCurrency,
      exchangeRate, userId,
    } = data;

    if (payerId === payeeId) {
      const error = new Error('Payer and payee cannot be the same person.');
      error.statusCode = 400;
      throw error;
    }

    // Verify both users have/had membership in the group
    const payerMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: payerId },
    });
    const payeeMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: payeeId },
    });

    if (!payerMembership || !payeeMembership) {
      const error = new Error('Both payer and payee must be members of the group.');
      error.statusCode = 400;
      throw error;
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });

    let finalExchangeRate = exchangeRate;
    if (!finalExchangeRate) {
      finalExchangeRate = await currencyService.getExchangeRate(
        originalCurrency,
        group.baseCurrency,
        'latest'
      );
    } else {
      finalExchangeRate = parseFloat(finalExchangeRate);
    }

    const normalizedAmount = currencyService.convertAmount(originalAmount, finalExchangeRate);

    const settlement = await settlementsRepository.create({
      groupId,
      payerId,
      payeeId,
      originalAmount,
      originalCurrency: originalCurrency.toUpperCase(),
      exchangeRate: finalExchangeRate,
      normalizedAmount,
      createdById: userId,
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.SETTLEMENT_RECORDED,
      entityType: ENTITY_TYPES.SETTLEMENT,
      entityId: settlement.id,
      metadata: { groupId, payerId, payeeId, originalAmount, originalCurrency, normalizedAmount },
    });

    return settlement;
  },

  /**
   * Get all settlements for a group.
   */
  async getGroupSettlements(groupId, userId) {
    // Verify user has access
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return settlementsRepository.findByGroupId(groupId);
  },
};

module.exports = settlementsService;
