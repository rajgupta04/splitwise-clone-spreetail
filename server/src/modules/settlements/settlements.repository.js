const prisma = require('../../config/database');

const settlementsRepository = {
  async create(data) {
    return prisma.settlement.create({
      data,
      include: {
        payer: { select: { id: true, name: true, email: true } },
        payee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async findByGroupId(groupId) {
    return prisma.settlement.findMany({
      where: { groupId },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        payee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { settledAt: 'desc' },
    });
  },
};

module.exports = settlementsRepository;
