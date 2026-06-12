const prisma = require('../../config/database');

/**
 * Expenses repository — data access for expenses and splits.
 */
const expensesRepository = {
  /**
   * Create an expense with splits in a transaction.
   */
  async createWithSplits(expenseData, splitsData) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: expenseData,
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      const splits = await Promise.all(
        splitsData.map((split) =>
          tx.expenseSplit.create({
            data: { ...split, expenseId: expense.id },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        )
      );

      return { ...expense, splits };
    });
  },

  /**
   * Find expenses for a group (non-deleted), with pagination.
   */
  async findByGroupId(groupId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId, isDeleted: false },
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          splits: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where: { groupId, isDeleted: false } }),
    ]);

    return { expenses, total };
  },

  /**
   * Find a single expense by ID with splits.
   */
  async findById(id) {
    return prisma.expense.findUnique({
      where: { id },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        splits: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        group: { select: { id: true, name: true, baseCurrency: true } },
      },
    });
  },

  /**
   * Update an expense and its splits.
   */
  async updateWithSplits(expenseId, expenseData, splitsData) {
    return prisma.$transaction(async (tx) => {
      // Delete existing splits
      await tx.expenseSplit.deleteMany({ where: { expenseId } });

      // Update expense
      const expense = await tx.expense.update({
        where: { id: expenseId },
        data: expenseData,
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Create new splits
      const splits = await Promise.all(
        splitsData.map((split) =>
          tx.expenseSplit.create({
            data: { ...split, expenseId },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        )
      );

      return { ...expense, splits };
    });
  },

  /**
   * Soft-delete an expense.
   */
  async softDelete(id) {
    return prisma.expense.update({
      where: { id },
      data: { isDeleted: true },
    });
  },
};

module.exports = expensesRepository;
