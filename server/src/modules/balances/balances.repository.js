const prisma = require('../../config/database');

/**
 * Balances repository — data access for balance calculations.
 * Uses raw SQL for efficient aggregation across expenses and settlements.
 */
const balancesRepository = {
  /**
   * Get all non-deleted expense splits for a group, grouped by payer and split user.
   * Returns the net amounts owed between each pair of users.
   *
   * This raw SQL aggregates across expenses to produce:
   * For each expense: split_user owes paidBy the split's normalizedAmount
   * (excluding self-splits where paidBy === split_user)
   */
  async getExpenseDebts(groupId) {
    return prisma.$queryRaw`
      SELECT
        es.user_id AS debtor_id,
        e.paid_by AS creditor_id,
        SUM(es.normalized_amount) AS total_amount
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = ${groupId}::uuid
        AND e.is_deleted = false
        AND es.user_id != e.paid_by
      GROUP BY es.user_id, e.paid_by
    `;
  },

  /**
   * Get all settlements for a group, aggregated by payer-payee pairs.
   */
  async getSettlementTotals(groupId) {
    return prisma.$queryRaw`
      SELECT
        payer_id,
        payee_id,
        SUM(normalized_amount) AS total_amount
      FROM settlements
      WHERE group_id = ${groupId}::uuid
      GROUP BY payer_id, payee_id
    `;
  },

  /**
   * Get all groups where a user is or was a member, with expense/settlement data.
   */
  async getUserGroupIds(userId) {
    const memberships = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
      distinct: ['groupId'],
    });
    return memberships.map((m) => m.groupId);
  },
};

module.exports = balancesRepository;
