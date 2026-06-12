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
