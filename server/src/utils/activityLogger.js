/**
 * Activity logger utility.
 * Records all significant actions in the activity_logs table for audit trail.
 *
 * Usage:
 *   const { logActivity } = require('../utils/activityLogger');
 *   await logActivity(prisma, {
 *     userId: req.user.id,
 *     action: ACTIVITY_ACTIONS.EXPENSE_CREATED,
 *     entityType: ENTITY_TYPES.EXPENSE,
 *     entityId: expense.id,
 *     metadata: { amount: expense.originalAmount, description: expense.description }
 *   });
 */

/**
 * Log an activity/decision to the activity_logs table.
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @param {object} params
 * @param {string} params.userId - ID of the user performing the action
 * @param {string} params.action - Action type (from ACTIVITY_ACTIONS constant)
 * @param {string} params.entityType - Entity type (from ENTITY_TYPES constant)
 * @param {string} params.entityId - ID of the affected entity
 * @param {object} [params.metadata] - Additional context (old values, new values, etc.)
 * @returns {Promise<object>} The created activity log record
 */
async function logActivity(prisma, { userId, action, entityType, entityId, metadata = null }) {
  try {
    return await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    // Activity logging should never crash the main operation.
    // Log the error but don't throw.
    console.error('Failed to log activity:', error.message);
    return null;
  }
}

module.exports = { logActivity };
