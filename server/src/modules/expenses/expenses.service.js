const { Decimal } = require('@prisma/client/runtime/library');
const prisma = require('../../config/database');
const expensesRepository = require('./expenses.repository');
const membershipsRepository = require('../memberships/memberships.repository');
const { logActivity } = require('../../utils/activityLogger');
const { ACTIVITY_ACTIONS, ENTITY_TYPES, SPLIT_TYPES } = require('../../config/constants');
const currencyService = require('../currency/currency.service');

/**
 * Expenses service — business logic for expense management.
 * Handles split calculation for all 4 split types.
 */
const expensesService = {
  /**
   * Create a new expense with calculated splits.
   *
   * @param {object} data
   * @param {string} data.groupId
   * @param {string} data.paidById - User who paid
   * @param {string} data.description
   * @param {number} data.originalAmount
   * @param {string} data.originalCurrency
   * @param {number} data.exchangeRate
   * @param {string} data.splitType - 'equal' | 'exact' | 'percentage' | 'shares'
   * @param {string} data.expenseDate
   * @param {Array} data.participants - Array of participant objects (format depends on split type)
   * @param {string} data.userId - Requesting user ID
   */
  async createExpense(data) {
    const {
      groupId, paidById, description, originalAmount, originalCurrency,
      exchangeRate, splitType, expenseDate, participants, userId,
    } = data;

    // Verify group exists and is active
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !group.isActive) {
      const error = new Error('Group not found.');
      error.statusCode = 404;
      throw error;
    }

    // Verify requesting user is an active member
    const userMembership = await membershipsRepository.findActiveMembership(groupId, userId);
    if (!userMembership) {
      const error = new Error('You are not an active member of this group.');
      error.statusCode = 403;
      throw error;
    }

    // Verify payer is a valid member on the expense date
    const payerValid = await membershipsRepository.isMemberOnDate(groupId, paidById, expenseDate);
    if (!payerValid) {
      const error = new Error('The payer was not a member of this group on the expense date.');
      error.statusCode = 400;
      throw error;
    }

    // Validate all participants were members on the expense date
    for (const participant of participants) {
      const isMember = await membershipsRepository.isMemberOnDate(
        groupId, participant.userId, expenseDate
      );
      if (!isMember) {
        const error = new Error(
          `User ${participant.userId} was not a member of this group on ${expenseDate}.`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // Determine exchange rate (fetch if not provided)
    let finalExchangeRate = exchangeRate;
    if (!finalExchangeRate) {
      finalExchangeRate = await currencyService.getExchangeRate(
        originalCurrency,
        group.baseCurrency,
        expenseDate
      );
    } else {
      finalExchangeRate = parseFloat(finalExchangeRate);
    }

    // Calculate normalized amount securely
    const normalizedAmount = currencyService.convertAmount(originalAmount, finalExchangeRate);

    // Calculate splits based on split type
    const splits = this._calculateSplits(
      splitType, originalAmount, normalizedAmount, finalExchangeRate, participants
    );

    // Create expense data
    const expenseData = {
      groupId,
      paidById,
      description,
      originalAmount,
      originalCurrency: originalCurrency.toUpperCase(),
      exchangeRate: finalExchangeRate,
      normalizedAmount,
      splitType,
      expenseDate: new Date(expenseDate),
      createdById: userId,
    };

    const expense = await expensesRepository.createWithSplits(expenseData, splits);

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
      entityType: ENTITY_TYPES.EXPENSE,
      entityId: expense.id,
      metadata: {
        description, originalAmount, originalCurrency, normalizedAmount,
        splitType, participantCount: participants.length,
      },
    });

    return expense;
  },

  /**
   * Calculate splits based on split type.
   * This is the core split calculation algorithm.
   *
   * @param {string} splitType
   * @param {number} originalAmount - Total amount in original currency
   * @param {number} normalizedAmount - Total amount in base currency
   * @param {number} exchangeRate
   * @param {Array} participants - Participant data (format varies by type)
   * @returns {Array} Array of split objects ready for database insertion
   *
   * ALGORITHM DOCUMENTATION:
   *
   * EQUAL: totalAmount / numberOfParticipants
   *   - Remainder cents distributed to first participant(s)
   *   - Example: $100 / 3 = $33.34, $33.33, $33.33
   *
   * EXACT: Each participant specifies their exact amount
   *   - Validation: sum of amounts must equal total
   *
   * PERCENTAGE: Each participant specifies their percentage
   *   - Validation: percentages must sum to 100
   *   - Amount = total × (percentage / 100)
   *
   * SHARES: Each participant specifies their share count
   *   - Amount = total × (userShares / totalShares)
   *   - Remainder cents distributed to first participant(s)
   */
  _calculateSplits(splitType, originalAmount, normalizedAmount, exchangeRate, participants) {
    switch (splitType) {
      case SPLIT_TYPES.EQUAL:
        return this._calculateEqualSplit(originalAmount, normalizedAmount, participants);
      case SPLIT_TYPES.EXACT:
        return this._calculateExactSplit(originalAmount, normalizedAmount, exchangeRate, participants);
      case SPLIT_TYPES.PERCENTAGE:
        return this._calculatePercentageSplit(originalAmount, normalizedAmount, participants);
      case SPLIT_TYPES.SHARES:
        return this._calculateSharesSplit(originalAmount, normalizedAmount, participants);
      default: {
        const error = new Error(`Unsupported split type: ${splitType}`);
        error.statusCode = 400;
        throw error;
      }
    }
  },

  /**
   * EQUAL SPLIT:
   * Divides total equally among all participants.
   * Distributes remainder cents to first participants to avoid rounding errors.
   */
  _calculateEqualSplit(originalAmount, normalizedAmount, participants) {
    const count = participants.length;
    if (count === 0) {
      const error = new Error('At least one participant is required.');
      error.statusCode = 400;
      throw error;
    }

    // Calculate base amount per person (in cents to avoid floating point)
    const totalCentsOriginal = Math.round(originalAmount * 100);
    const totalCentsNormalized = Math.round(normalizedAmount * 100);

    const baseCentsOriginal = Math.floor(totalCentsOriginal / count);
    const baseCentsNormalized = Math.floor(totalCentsNormalized / count);

    const remainderOriginal = totalCentsOriginal - baseCentsOriginal * count;
    const remainderNormalized = totalCentsNormalized - baseCentsNormalized * count;

    return participants.map((p, index) => ({
      userId: p.userId,
      originalAmount: (baseCentsOriginal + (index < remainderOriginal ? 1 : 0)) / 100,
      normalizedAmount: (baseCentsNormalized + (index < remainderNormalized ? 1 : 0)) / 100,
      percentage: null,
      shares: null,
    }));
  },

  /**
   * EXACT SPLIT:
   * Each participant specifies their exact owed amount in original currency.
   * Validates that amounts sum to total.
   */
  _calculateExactSplit(originalAmount, normalizedAmount, exchangeRate, participants) {
    const sum = participants.reduce((acc, p) => acc + p.amount, 0);
    const tolerance = 0.01;

    if (Math.abs(sum - originalAmount) > tolerance) {
      const error = new Error(
        `Exact split amounts (${sum}) do not add up to the total (${originalAmount}).`
      );
      error.statusCode = 400;
      throw error;
    }

    return participants.map((p) => ({
      userId: p.userId,
      originalAmount: p.amount,
      normalizedAmount: parseFloat((p.amount * exchangeRate).toFixed(2)),
      percentage: null,
      shares: null,
    }));
  },

  /**
   * PERCENTAGE SPLIT:
   * Each participant specifies their percentage (must sum to 100).
   */
  _calculatePercentageSplit(originalAmount, normalizedAmount, participants) {
    const totalPercentage = participants.reduce((acc, p) => acc + p.percentage, 0);
    const tolerance = 0.01;

    if (Math.abs(totalPercentage - 100) > tolerance) {
      const error = new Error(
        `Percentages (${totalPercentage}%) do not add up to 100%.`
      );
      error.statusCode = 400;
      throw error;
    }

    return participants.map((p) => ({
      userId: p.userId,
      originalAmount: parseFloat(((originalAmount * p.percentage) / 100).toFixed(2)),
      normalizedAmount: parseFloat(((normalizedAmount * p.percentage) / 100).toFixed(2)),
      percentage: p.percentage,
      shares: null,
    }));
  },

  /**
   * SHARES SPLIT:
   * Each participant specifies share count. Amount proportional to shares.
   * Distributes remainder cents to first participants.
   */
  _calculateSharesSplit(originalAmount, normalizedAmount, participants) {
    const totalShares = participants.reduce((acc, p) => acc + p.shares, 0);

    if (totalShares <= 0) {
      const error = new Error('Total shares must be greater than zero.');
      error.statusCode = 400;
      throw error;
    }

    // Use cents for precise distribution
    const totalCentsOriginal = Math.round(originalAmount * 100);
    const totalCentsNormalized = Math.round(normalizedAmount * 100);

    // First pass: allocate floor amounts
    let allocatedOriginal = 0;
    let allocatedNormalized = 0;

    const splits = participants.map((p) => {
      const origCents = Math.floor((totalCentsOriginal * p.shares) / totalShares);
      const normCents = Math.floor((totalCentsNormalized * p.shares) / totalShares);
      allocatedOriginal += origCents;
      allocatedNormalized += normCents;

      return {
        userId: p.userId,
        originalCents: origCents,
        normalizedCents: normCents,
        shares: p.shares,
      };
    });

    // Distribute remainders to first participants
    const remainderOriginal = totalCentsOriginal - allocatedOriginal;
    const remainderNormalized = totalCentsNormalized - allocatedNormalized;

    for (let i = 0; i < remainderOriginal; i++) {
      splits[i].originalCents += 1;
    }
    for (let i = 0; i < remainderNormalized; i++) {
      splits[i].normalizedCents += 1;
    }

    return splits.map((s) => ({
      userId: s.userId,
      originalAmount: s.originalCents / 100,
      normalizedAmount: s.normalizedCents / 100,
      percentage: null,
      shares: s.shares,
    }));
  },

  /**
   * Get expenses for a group with pagination.
   */
  async getGroupExpenses(groupId, userId, { page, limit }) {
    // Verify user has access
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return expensesRepository.findByGroupId(groupId, { page, limit });
  },

  /**
   * Get a single expense.
   */
  async getExpenseById(expenseId, userId) {
    const expense = await expensesRepository.findById(expenseId);

    if (!expense || expense.isDeleted) {
      const error = new Error('Expense not found.');
      error.statusCode = 404;
      throw error;
    }

    // Verify user has access to the group
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId: expense.groupId, userId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return expense;
  },

  /**
   * Update an expense.
   */
  async updateExpense(expenseId, data, userId) {
    const existingExpense = await this.getExpenseById(expenseId, userId);

    // Capture old values for audit
    const oldValues = {
      description: existingExpense.description,
      originalAmount: existingExpense.originalAmount,
      splitType: existingExpense.splitType,
    };

    const {
      paidById, description, originalAmount, originalCurrency,
      exchangeRate, splitType, expenseDate, participants,
    } = data;

    const dateToCheck = expenseDate || existingExpense.expenseDate;

    // Determine exchange rate
    let finalExchangeRate = exchangeRate;
    if (!finalExchangeRate && originalCurrency) {
      const group = await prisma.group.findUnique({ where: { id: existingExpense.groupId } });
      finalExchangeRate = await currencyService.getExchangeRate(
        originalCurrency,
        group.baseCurrency,
        dateToCheck
      );
    } else {
      finalExchangeRate = parseFloat(finalExchangeRate || existingExpense.exchangeRate);
    }

    const currentOriginalCurrency = originalCurrency || existingExpense.originalCurrency;
    const normalizedAmount = currencyService.convertAmount(originalAmount, finalExchangeRate);

    // Validate membership for all participants on expense date
    for (const participant of participants) {
      const isMember = await membershipsRepository.isMemberOnDate(
        existingExpense.groupId, participant.userId, dateToCheck
      );
      if (!isMember) {
        const error = new Error(
          `User ${participant.userId} was not a member on ${dateToCheck}.`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const splits = this._calculateSplits(
      splitType, originalAmount, normalizedAmount, finalExchangeRate, participants
    );

    const expenseData = {
      paidById,
      description,
      originalAmount,
      originalCurrency: currentOriginalCurrency.toUpperCase(),
      exchangeRate: finalExchangeRate,
      normalizedAmount,
      splitType,
      expenseDate: new Date(expenseDate),
    };

    const updatedExpense = await expensesRepository.updateWithSplits(expenseId, expenseData, splits);

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.EXPENSE_UPDATED,
      entityType: ENTITY_TYPES.EXPENSE,
      entityId: expenseId,
      metadata: { oldValues, newValues: { description, originalAmount, splitType } },
    });

    return updatedExpense;
  },

  /**
   * Soft-delete an expense.
   */
  async deleteExpense(expenseId, userId) {
    const expense = await this.getExpenseById(expenseId, userId);

    await expensesRepository.softDelete(expenseId);

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.EXPENSE_DELETED,
      entityType: ENTITY_TYPES.EXPENSE,
      entityId: expenseId,
      metadata: {
        description: expense.description,
        originalAmount: expense.originalAmount,
        originalCurrency: expense.originalCurrency,
      },
    });
  },
};

module.exports = expensesService;
