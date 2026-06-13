const prisma = require('../../config/database');

/**
 * Memberships repository — data access for group memberships.
 * Contains raw SQL for temporal membership queries where Prisma is insufficient.
 */
const membershipsRepository = {
  /**
   * Find active membership for a user in a group.
   */
  async findActiveMembership(groupId, userId) {
    return prisma.groupMembership.findFirst({
      where: { groupId, userId, status: 'active' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  },

  /**
   * Find all memberships (active and inactive) for a user in a group.
   * Used for membership history.
   */
  async findAllMemberships(groupId, userId) {
    return prisma.groupMembership.findMany({
      where: { groupId, userId },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  },

  /**
   * Get all active members of a group.
   */
  async getActiveMembers(groupId) {
    return prisma.groupMembership.findMany({
      where: { groupId, status: 'active' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  },

  /**
   * Get full membership history for a group (all members, all time).
   */
  async getMembershipHistory(groupId) {
    return prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ userId: 'asc' }, { joinedAt: 'asc' }],
    });
  },

  /**
   * Add a new member to a group.
   */
  async addMember(groupId, userId) {
    return prisma.groupMembership.create({
      data: { groupId, userId, status: 'active' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  },

  /**
   * Remove a member from a group (set left_at and status to inactive).
   */
  async removeMember(membershipId) {
    return prisma.groupMembership.update({
      where: { id: membershipId },
      data: { leftAt: new Date(), status: 'inactive' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  },

  /**
   * TEMPORAL QUERY: Check if a user was an active member of a group on a specific date.
   * Uses raw SQL because Prisma cannot express date-range intersection elegantly.
   *
   * @param {string} groupId - Group UUID
   * @param {string} userId - User UUID
   * @param {Date|string} date - The date to check membership for
   * @returns {Promise<boolean>} True if the user was a member on that date
   */
  async isMemberOnDate(groupId, userId, date) {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM group_memberships
        WHERE group_id = ${groupId}::text
          AND user_id = ${userId}::text
          AND joined_at <= ${new Date(date)}
          AND (left_at IS NULL OR left_at >= ${new Date(date)})
      ) AS is_member
    `;
    return result[0]?.is_member ?? false;
  },

  /**
   * TEMPORAL QUERY: Get all users who were active members of a group on a specific date.
   *
   * @param {string} groupId - Group UUID
   * @param {Date|string} date - The date to check
   * @returns {Promise<Array>} Array of user objects who were members on that date
   */
  async getActiveMembersOnDate(groupId, date) {
    return prisma.$queryRaw`
      SELECT u.id, u.name, u.email
      FROM group_memberships gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ${groupId}::text
        AND gm.joined_at <= ${new Date(date)}
        AND (gm.left_at IS NULL OR gm.left_at >= ${new Date(date)})
    `;
  },

  /**
   * Find a user by email.
   */
  async findUserByEmail(email) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true },
    });
  },
};

module.exports = membershipsRepository;
