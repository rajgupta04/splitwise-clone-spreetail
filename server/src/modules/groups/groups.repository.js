const prisma = require('../../config/database');

/**
 * Groups repository — data access layer for groups.
 */
const groupsRepository = {
  /**
   * Create a new group.
   */
  async create({ name, description, baseCurrency, createdById }) {
    return prisma.group.create({
      data: { name, description, baseCurrency, createdById },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
  },

  /**
   * Find all groups a user is an active member of.
   */
  async findByUserId(userId) {
    return prisma.group.findMany({
      where: {
        isActive: true,
        memberships: {
          some: { userId, status: 'active' },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        memberships: {
          where: { status: 'active' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { expenses: { where: { isDeleted: false } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  /**
   * Find a group by ID.
   */
  async findById(id) {
    return prisma.group.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        memberships: {
          where: { status: 'active' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
  },

  /**
   * Update group details.
   */
  async update(id, data) {
    return prisma.group.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  /**
   * Soft-delete (archive) a group.
   */
  async archive(id) {
    return prisma.group.update({
      where: { id },
      data: { isActive: false },
    });
  },
};

module.exports = groupsRepository;
