const prisma = require('../../config/database');
const membershipsRepository = require('./memberships.repository');
const { logActivity } = require('../../utils/activityLogger');
const { ACTIVITY_ACTIONS, ENTITY_TYPES } = require('../../config/constants');

/**
 * Memberships service — business logic for group membership management.
 */
const membershipsService = {
  /**
   * Add a member to a group by email.
   * Validates: user exists, not already an active member.
   */
  async addMember(groupId, userEmail, requestingUserId) {
    // Verify requesting user is a member of the group
    const requestingMembership = await membershipsRepository.findActiveMembership(
      groupId,
      requestingUserId
    );
    if (!requestingMembership) {
      const error = new Error('You are not an active member of this group.');
      error.statusCode = 403;
      throw error;
    }

    // Find the user to add by email
    const userToAdd = await membershipsRepository.findUserByEmail(userEmail);
    if (!userToAdd) {
      const error = new Error(`No user found with email: ${userEmail}`);
      error.statusCode = 404;
      throw error;
    }

    // Check if already an active member
    const existingMembership = await membershipsRepository.findActiveMembership(
      groupId,
      userToAdd.id
    );
    if (existingMembership) {
      const error = new Error('User is already an active member of this group.');
      error.statusCode = 409;
      throw error;
    }

    // Add member (new record — supports rejoin with new joined_at)
    const membership = await membershipsRepository.addMember(groupId, userToAdd.id);

    await logActivity(prisma, {
      userId: requestingUserId,
      action: ACTIVITY_ACTIONS.MEMBER_ADDED,
      entityType: ENTITY_TYPES.MEMBERSHIP,
      entityId: membership.id,
      metadata: { groupId, addedUserId: userToAdd.id, addedUserEmail: userEmail },
    });

    return membership;
  },

  /**
   * Remove a member from a group.
   * Sets left_at to now and status to inactive.
   * Debts persist after removal per business rules.
   */
  async removeMember(groupId, userIdToRemove, requestingUserId) {
    // Verify requesting user is a member
    const requestingMembership = await membershipsRepository.findActiveMembership(
      groupId,
      requestingUserId
    );
    if (!requestingMembership) {
      const error = new Error('You are not an active member of this group.');
      error.statusCode = 403;
      throw error;
    }

    // Find the active membership of the user to remove
    const membership = await membershipsRepository.findActiveMembership(
      groupId,
      userIdToRemove
    );
    if (!membership) {
      const error = new Error('User is not an active member of this group.');
      error.statusCode = 404;
      throw error;
    }

    // Remove (deactivate) the membership
    const updatedMembership = await membershipsRepository.removeMember(membership.id);

    await logActivity(prisma, {
      userId: requestingUserId,
      action: ACTIVITY_ACTIONS.MEMBER_REMOVED,
      entityType: ENTITY_TYPES.MEMBERSHIP,
      entityId: membership.id,
      metadata: { groupId, removedUserId: userIdToRemove },
    });

    return updatedMembership;
  },

  /**
   * Get active members of a group.
   */
  async getActiveMembers(groupId, requestingUserId) {
    // Verify requesting user has access (current or historical)
    const userMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: requestingUserId },
    });
    if (!userMembership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return membershipsRepository.getActiveMembers(groupId);
  },

  /**
   * Get full membership history of a group.
   */
  async getMembershipHistory(groupId, requestingUserId) {
    // Verify requesting user has access
    const userMembership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: requestingUserId },
    });
    if (!userMembership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return membershipsRepository.getMembershipHistory(groupId);
  },
};

module.exports = membershipsService;
