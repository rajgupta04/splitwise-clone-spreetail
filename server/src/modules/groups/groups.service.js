const prisma = require('../../config/database');
const groupsRepository = require('./groups.repository');
const { logActivity } = require('../../utils/activityLogger');
const { ACTIVITY_ACTIONS, ENTITY_TYPES, MEMBERSHIP_STATUS } = require('../../config/constants');

/**
 * Groups service — business logic for group management.
 */
const groupsService = {
  /**
   * Create a new group and add the creator as the first member.
   */
  async createGroup({ name, description, baseCurrency, userId }) {
    // Use transaction: create group + add creator as member
    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: { name, description, baseCurrency, createdById: userId },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      });

      // Auto-add creator as first member
      await tx.groupMembership.create({
        data: {
          groupId: newGroup.id,
          userId,
          status: MEMBERSHIP_STATUS.ACTIVE,
        },
      });

      return newGroup;
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.GROUP_CREATED,
      entityType: ENTITY_TYPES.GROUP,
      entityId: group.id,
      metadata: { name, description, baseCurrency },
    });
    return group;
  },

  /**
   * Create a Mock Test Group using data from Expenses Export.csv.
   */
  async createMockTestGroup(userId) {
    const bcrypt = require('bcryptjs');

    // Parse the known unique names from the specific CSV provided by the user
    // The names are: Aisha, Rohan, Priya, Meera, Dev
    const mockNames = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev'];

    // Create the group
    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name: 'Mock Test Group (INR)',
          description: 'DISCLAIMER: These users and this group are only for testing purpose according to given data.',
          baseCurrency: 'INR',
          createdById: userId,
        },
      });

      // Add current user
      await tx.groupMembership.create({
        data: { groupId: newGroup.id, userId, status: MEMBERSHIP_STATUS.ACTIVE },
      });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      // Add mock users
      for (const name of mockNames) {
        const email = `${name.toLowerCase()}@mock.test`;
        let user = await tx.user.findUnique({ where: { email } });
        if (!user) {
          user = await tx.user.create({
            data: { email, name, passwordHash, preferredCurrency: 'INR' },
          });
        }
        await tx.groupMembership.create({
          data: { groupId: newGroup.id, userId: user.id, status: MEMBERSHIP_STATUS.ACTIVE },
        });
      }

      return newGroup;
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.GROUP_CREATED,
      entityType: ENTITY_TYPES.GROUP,
      entityId: group.id,
      metadata: { name: group.name, isMock: true },
    });

    return group;
  },

  /**
   * Get all groups for a user.
   */
  async getUserGroups(userId) {
    return groupsRepository.findByUserId(userId);
  },

  /**
   * Get a single group by ID.
   * Verifies the requesting user is a member.
   */
  async getGroupById(groupId, userId) {
    const group = await groupsRepository.findById(groupId);

    if (!group || !group.isActive) {
      const error = new Error('Group not found.');
      error.statusCode = 404;
      throw error;
    }

    // Verify user is a member (current or historical)
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId },
    });

    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return group;
  },

  /**
   * Update group details.
   */
  async updateGroup(groupId, userId, { name, description, baseCurrency }) {
    // Verify group exists and user is a member
    await this.getGroupById(groupId, userId);

    const updatedGroup = await groupsRepository.update(groupId, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(baseCurrency !== undefined && { baseCurrency }),
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.GROUP_UPDATED,
      entityType: ENTITY_TYPES.GROUP,
      entityId: groupId,
      metadata: { name, description, baseCurrency },
    });

    return updatedGroup;
  },

  /**
   * Archive (soft-delete) a group.
   */
  async archiveGroup(groupId, userId) {
    await this.getGroupById(groupId, userId);
    await groupsRepository.archive(groupId);

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.GROUP_ARCHIVED,
      entityType: ENTITY_TYPES.GROUP,
      entityId: groupId,
    });
  },
};

module.exports = groupsService;
