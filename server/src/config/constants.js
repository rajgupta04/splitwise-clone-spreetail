// Application-wide constants

module.exports = {
  // Split types
  SPLIT_TYPES: {
    EQUAL: 'equal',
    EXACT: 'exact',
    PERCENTAGE: 'percentage',
    SHARES: 'shares',
  },

  // Membership statuses
  MEMBERSHIP_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },

  // Import statuses
  IMPORT_STATUS: {
    PROCESSING: 'processing',
    PENDING_REVIEW: 'pending_review',
    COMPLETED: 'completed',
    PARTIALLY_COMPLETED: 'partially_completed',
    FAILED: 'failed',
  },

  // Import item statuses
  IMPORT_ITEM_STATUS: {
    PENDING: 'pending',
    CLEAN: 'clean',
    FLAGGED: 'flagged',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    ERROR: 'error',
    IMPORTED: 'imported',
    FAILED: 'failed',
    RESOLVED: 'resolved',
    SKIPPED: 'skipped',
  },

  // Anomaly types
  ANOMALY_TYPES: {
    DUPLICATE_EXPENSE: 'duplicate_expense',
    AMOUNT_OUTLIER: 'amount_outlier',
    MEMBERSHIP_VIOLATION: 'membership_violation',
    FUTURE_DATED: 'future_dated',
    MISSING_FIELDS: 'missing_fields',
    INVALID_SPLIT: 'invalid_split',
    UNKNOWN_PARTICIPANT: 'unknown_participant',
    SETTLEMENT_AS_EXPENSE: 'settlement_as_expense',
    NAME_MISMATCH: 'name_mismatch',
    FORMAT_ERROR: 'format_error',
    ZERO_AMOUNT: 'zero_amount',
    NEGATIVE_AMOUNT: 'negative_amount',
    AMBIGUOUS_DATE: 'ambiguous_date',
    INVALID_DATE: 'invalid_date',
    CONFLICTING_SPLIT_DATA: 'conflicting_split_data',
    ROUNDING_ISSUE: 'rounding_issue',
    MISSING_CURRENCY: 'missing_currency',
    CURRENCY_FOREIGN: 'currency_foreign',
    FINALIZATION_ERROR: 'finalization_error',
  },

  // CSV split type aliases (map CSV values to our system values)
  SPLIT_TYPE_ALIASES: {
    'unequal': 'exact',
    'share': 'shares',
  },

  // Anomaly severity
  ANOMALY_SEVERITY: {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
  },

  // Import decisions
  DECISIONS: {
    APPROVE: 'approve',
    REJECT: 'reject',
  },

  // Activity log actions
  ACTIVITY_ACTIONS: {
    EXPENSE_CREATED: 'expense_created',
    EXPENSE_UPDATED: 'expense_updated',
    EXPENSE_DELETED: 'expense_deleted',
    GROUP_CREATED: 'group_created',
    GROUP_UPDATED: 'group_updated',
    GROUP_ARCHIVED: 'group_archived',
    MEMBER_ADDED: 'member_added',
    MEMBER_REMOVED: 'member_removed',
    SETTLEMENT_RECORDED: 'settlement_recorded',
    IMPORT_UPLOADED: 'import_uploaded',
    IMPORT_ITEM_APPROVED: 'import_item_approved',
    IMPORT_ITEM_REJECTED: 'import_item_rejected',
    IMPORT_ITEM_RESOLVED: 'import_item_resolved',
    IMPORT_FINALIZED: 'import_finalized',
    IMPORT_EXECUTED: 'import_executed',
  },

  // Entity types for activity logs
  ENTITY_TYPES: {
    EXPENSE: 'expense',
    GROUP: 'group',
    MEMBERSHIP: 'membership',
    SETTLEMENT: 'settlement',
    IMPORT: 'import',
    IMPORT_ITEM: 'import_item',
  },

  // Anomaly detection thresholds
  ANOMALY_THRESHOLDS: {
    AMOUNT_OUTLIER_MULTIPLIER: 2, // Flag if > 2x group average
    AMOUNT_ABSOLUTE_CAP: 10000,   // Flag if > $10,000 equivalent
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
};
