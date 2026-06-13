const prisma = require('../../config/database');
const balancesRepository = require('./balances.repository');

/**
 * Balances service — core balance calculation engine.
 *
 * ALGORITHM OVERVIEW (documented per project requirements):
 *
 * 1. Gather all expense splits for the group → each split represents a debt
 *    from split.userId to expense.paidById of split.normalizedAmount
 *
 * 2. Gather all settlements → each settlement reduces the debt from
 *    settlement.payerId to settlement.payeeId
 *
 * 3. Build net balance per user:
 *    net[user] = (total owed TO user) - (total user OWES)
 *    Positive = net creditor, Negative = net debtor
 *
 * 4. Simplify debts using greedy algorithm:
 *    Match largest debtor with largest creditor, settle the minimum of their
 *    balances, repeat. This minimizes the number of transactions.
 *
 * All calculations use normalizedAmount (group's base currency).
 */
const balancesService = {
  /**
   * Calculate balances for a group.
   * Returns simplified debts (who owes whom and how much).
   *
   * @param {string} groupId
   * @param {string} userId - Requesting user (for access check)
   * @returns {Promise<object>} { balances, simplifiedDebts, memberBalances }
   */
  async getGroupBalances(groupId, userId) {
    // Verify user has access
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    // Get group info
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { baseCurrency: true },
    });

    // Step 1: Get all expense-based debts
    const expenseDebts = await balancesRepository.getExpenseDebts(groupId);

    // Step 2: Get all settlement totals
    const settlementTotals = await balancesRepository.getSettlementTotals(groupId);

    // Step 3: Build net balance per user
    const netBalances = {};

    // Process expense debts: debtor owes creditor
    for (const debt of expenseDebts) {
      const amount = parseFloat(debt.total_amount);
      const debtorId = debt.debtor_id;
      const creditorId = debt.creditor_id;

      netBalances[debtorId] = (netBalances[debtorId] || 0) - amount;
      netBalances[creditorId] = (netBalances[creditorId] || 0) + amount;
    }

    // Process settlements: payer has paid payee (reduces payer's debt)
    for (const settlement of settlementTotals) {
      const amount = parseFloat(settlement.total_amount);
      const payerId = settlement.payer_id;
      const payeeId = settlement.payee_id;

      netBalances[payerId] = (netBalances[payerId] || 0) + amount;
      netBalances[payeeId] = (netBalances[payeeId] || 0) - amount;
    }

    // Get user details for the response
    const userIds = Object.keys(netBalances);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Build member balances array
    const memberBalances = userIds.map((uid) => ({
      user: userMap[uid] || { id: uid, name: 'Unknown', email: '' },
      balance: parseFloat(netBalances[uid].toFixed(2)),
    }));

    // Step 4: Simplify debts
    const simplifiedDebts = this._simplifyDebts(netBalances, userMap);

    return {
      currency: group.baseCurrency,
      memberBalances,
      simplifiedDebts,
    };
  },

  /**
   * Debt simplification algorithm (greedy).
   *
   * ALGORITHM:
   * 1. Separate users into debtors (negative balance) and creditors (positive balance)
   * 2. Sort debtors ascending (most debt first), creditors descending (most credit first)
   * 3. Match largest debtor with largest creditor
   * 4. Transfer the minimum of their absolute balances
   * 5. Update balances, remove settled users
   * 6. Repeat until all balanced
   *
   * This produces the minimum number of transactions to settle all debts.
   *
   * @param {object} netBalances - { userId: netAmount }
   * @param {object} userMap - { userId: { id, name, email } }
   * @returns {Array} Array of { from, to, amount }
   */
  _simplifyDebts(netBalances, userMap) {
    const threshold = 0.01; // Ignore sub-cent differences

    // Build sorted arrays
    const debtors = []; // Users who owe money (negative balance)
    const creditors = []; // Users who are owed money (positive balance)

    for (const [userId, balance] of Object.entries(netBalances)) {
      const rounded = parseFloat(balance.toFixed(2));
      if (rounded < -threshold) {
        debtors.push({ userId, amount: Math.abs(rounded) });
      } else if (rounded > threshold) {
        creditors.push({ userId, amount: rounded });
      }
    }

    // Sort: debtors descending by amount, creditors descending by amount
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const transferAmount = parseFloat(
        Math.min(debtors[i].amount, creditors[j].amount).toFixed(2)
      );

      if (transferAmount > threshold) {
        transactions.push({
          from: userMap[debtors[i].userId] || { id: debtors[i].userId },
          to: userMap[creditors[j].userId] || { id: creditors[j].userId },
          amount: transferAmount,
        });
      }

      debtors[i].amount = parseFloat((debtors[i].amount - transferAmount).toFixed(2));
      creditors[j].amount = parseFloat((creditors[j].amount - transferAmount).toFixed(2));

      if (debtors[i].amount <= threshold) i++;
      if (creditors[j].amount <= threshold) j++;
    }

    return transactions;
  },

  /**
   * Get a user's balance summary across all groups.
   */
  async getUserBalanceSummary(userId) {
    const groupIds = await balancesRepository.getUserGroupIds(userId);

    const groupBalances = [];
    let totalOwed = 0; // Total others owe this user
    let totalOwing = 0; // Total this user owes others

    for (const groupId of groupIds) {
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true, name: true, baseCurrency: true, isActive: true },
      });

      if (!group) continue;

      const balances = await this.getGroupBalances(groupId, userId);

      // Find this user's net balance in the group
      const userBalance = balances.memberBalances.find((mb) => mb.user.id === userId);
      const netBalance = userBalance ? userBalance.balance : 0;

      if (netBalance > 0) totalOwed += netBalance;
      if (netBalance < 0) totalOwing += Math.abs(netBalance);

      groupBalances.push({
        group,
        netBalance: parseFloat(netBalance.toFixed(2)),
        currency: balances.currency,
        simplifiedDebts: balances.simplifiedDebts.filter(
          (d) => d.from.id === userId || d.to.id === userId
        ),
      });
    }

    return {
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalOwing: parseFloat(totalOwing.toFixed(2)),
      netBalance: parseFloat((totalOwed - totalOwing).toFixed(2)),
      groupBalances,
    };
  },

  /**
   * Get a detailed breakdown of which expenses contribute to a user's balance.
   * Rohan's requirement: "If the app says I owe ₹2,300, I want to see exactly which expenses make that up."
   *
   * @param {string} groupId
   * @param {string} targetUserId - The user whose breakdown we want
   * @param {string} requestingUserId - The user making the request (for access check)
   */
  async getBalanceBreakdown(groupId, targetUserId, requestingUserId) {
    // Verify access
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: requestingUserId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { baseCurrency: true },
    });

    // Get all expenses where the target user paid (they are owed money)
    const expensesPaid = await prisma.expense.findMany({
      where: { groupId, paidById: targetUserId, isDeleted: false },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { expenseDate: 'desc' },
    });

    // Get all expense splits where the target user owes money
    const splitsOwed = await prisma.expenseSplit.findMany({
      where: {
        userId: targetUserId,
        expense: { groupId, isDeleted: false, paidById: { not: targetUserId } },
      },
      include: {
        expense: {
          include: {
            paidBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Get all settlements involving this user
    const settlementsPaid = await prisma.settlement.findMany({
      where: { groupId, payerId: targetUserId },
      include: { payee: { select: { id: true, name: true } } },
      orderBy: { settledAt: 'desc' },
    });
    const settlementsReceived = await prisma.settlement.findMany({
      where: { groupId, payeeId: targetUserId },
      include: { payer: { select: { id: true, name: true } } },
      orderBy: { settledAt: 'desc' },
    });

    // Build owed-to-user items (from expenses they paid, others' splits)
    const owedToUser = expensesPaid.map((exp) => {
      const otherSplits = exp.splits.filter((s) => s.userId !== targetUserId);
      const totalOwed = otherSplits.reduce((sum, s) => sum + parseFloat(s.normalizedAmount), 0);
      return {
        type: 'expense_paid',
        id: exp.id,
        description: exp.description,
        date: exp.expenseDate,
        totalAmount: parseFloat(exp.normalizedAmount),
        netEffect: parseFloat(totalOwed.toFixed(2)), // positive: others owe this user
        currency: group.baseCurrency,
        splitDetails: otherSplits.map((s) => ({
          user: s.user,
          amount: parseFloat(s.normalizedAmount),
        })),
      };
    });

    // Build user-owes items (from other people's expenses where user has a split)
    const userOwes = splitsOwed.map((split) => ({
      type: 'expense_owed',
      id: split.expense.id,
      description: split.expense.description,
      date: split.expense.expenseDate,
      paidBy: split.expense.paidBy,
      netEffect: -parseFloat(split.normalizedAmount), // negative: user owes this
      currency: group.baseCurrency,
      splitAmount: parseFloat(split.normalizedAmount),
    }));

    // Build settlement items
    const settlementItems = [
      ...settlementsPaid.map((s) => ({
        type: 'settlement_paid',
        id: s.id,
        description: `Paid ${s.payee.name}`,
        date: s.settledAt,
        netEffect: parseFloat(s.normalizedAmount), // positive: reduces what user owes
        currency: group.baseCurrency,
        to: s.payee,
      })),
      ...settlementsReceived.map((s) => ({
        type: 'settlement_received',
        id: s.id,
        description: `Received from ${s.payer.name}`,
        date: s.settledAt,
        netEffect: -parseFloat(s.normalizedAmount), // negative: reduces what others owe user
        currency: group.baseCurrency,
        from: s.payer,
      })),
    ];

    // Combine all and sort by date
    const allItems = [...owedToUser, ...userOwes, ...settlementItems]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalNet = allItems.reduce((sum, item) => sum + item.netEffect, 0);

    return {
      userId: targetUserId,
      currency: group.baseCurrency,
      netBalance: parseFloat(totalNet.toFixed(2)),
      items: allItems,
    };
  },
};

module.exports = balancesService;
