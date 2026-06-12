const prisma = require('../../config/database');
const importsRepository = require('./imports.repository');
const { logActivity } = require('../../utils/activityLogger');
const {
  ACTIVITY_ACTIONS, ENTITY_TYPES, IMPORT_STATUS,
  IMPORT_ITEM_STATUS, ANOMALY_SEVERITY,
} = require('../../config/constants');

/**
 * Imports service — business logic for CSV import workflow.
 *
 * PLACEHOLDER: CSV parsing and anomaly detection are NOT implemented yet.
 * They will be built after analyzing the expenses_export.csv file.
 *
 * Current capabilities:
 * - Upload and create import record
 * - List imports for a group
 * - Get import details and items
 * - Approve/reject individual items (decision logging)
 * - Finalize import (create expenses from approved items)
 */
const importsService = {
  /**
   * Upload a CSV file and create an import job.
   * PLACEHOLDER: Does not parse CSV yet — creates the import record
   * and marks it as pending_review with no items.
   */
  async uploadCsv(groupId, userId, file) {
    // Verify user is an active member
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId, status: 'active' },
    });
    if (!membership) {
      const error = new Error('You are not an active member of this group.');
      error.statusCode = 403;
      throw error;
    }

    // Verify group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !group.isActive) {
      const error = new Error('Group not found.');
      error.statusCode = 404;
      throw error;
    }

    // Create import record
    const csvImport = await importsRepository.createImport({
      groupId,
      uploadedById: userId,
      fileName: file.originalname,
      status: IMPORT_STATUS.PENDING_REVIEW,
      totalRows: 0,
      validRows: 0,
      flaggedRows: 0,
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.IMPORT_UPLOADED,
      entityType: ENTITY_TYPES.IMPORT,
      entityId: csvImport.id,
      metadata: { fileName: file.originalname, groupId },
    });

    // TODO: Parse CSV, run anomaly detection, create import items
    // This will be implemented after CSV format analysis

    return csvImport;
  },

  /**
   * Get all imports for a group.
   */
  async getGroupImports(groupId, userId) {
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return importsRepository.findByGroupId(groupId);
  },

  /**
   * Get import details.
   */
  async getImportById(importId, userId) {
    const csvImport = await importsRepository.findById(importId);
    if (!csvImport) {
      const error = new Error('Import not found.');
      error.statusCode = 404;
      throw error;
    }

    // Verify access
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId: csvImport.groupId, userId },
    });
    if (!membership) {
      const error = new Error('You are not a member of this group.');
      error.statusCode = 403;
      throw error;
    }

    return csvImport;
  },

  /**
   * Get all items in an import.
   */
  async getImportItems(importId, userId, { status } = {}) {
    const csvImport = await this.getImportById(importId, userId);
    return importsRepository.findItemsByImportId(importId, { status });
  },

  /**
   * Approve or reject a single import item.
   * Only the uploader can make decisions.
   */
  async decideItem(importId, itemId, userId, { decision, reason }) {
    const csvImport = await this.getImportById(importId, userId);

    // Only the uploader can approve/reject
    if (csvImport.uploadedById !== userId) {
      const error = new Error('Only the uploader can approve or reject import items.');
      error.statusCode = 403;
      throw error;
    }

    // Verify import is in reviewable state
    if (csvImport.status !== IMPORT_STATUS.PENDING_REVIEW) {
      const error = new Error('This import is not in a reviewable state.');
      error.statusCode = 400;
      throw error;
    }

    // Get the item
    const item = await importsRepository.findItemById(itemId);
    if (!item || item.importId !== importId) {
      const error = new Error('Import item not found.');
      error.statusCode = 404;
      throw error;
    }

    // Cannot approve items with error-severity anomalies
    if (decision === 'approve') {
      const hasErrors = item.anomalyFlags.some(
        (flag) => flag.severity === ANOMALY_SEVERITY.ERROR
      );
      if (hasErrors) {
        const error = new Error(
          'Cannot approve items with error-severity anomalies. Fix the data and re-import.'
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // Create decision record
    const decisionRecord = await importsRepository.createDecision({
      importItemId: itemId,
      decision,
      decidedById: userId,
      reason,
    });

    // Update item status
    const newStatus = decision === 'approve'
      ? IMPORT_ITEM_STATUS.APPROVED
      : IMPORT_ITEM_STATUS.REJECTED;
    await importsRepository.updateItemStatus(itemId, newStatus);

    // Log activity
    const action = decision === 'approve'
      ? ACTIVITY_ACTIONS.IMPORT_ITEM_APPROVED
      : ACTIVITY_ACTIONS.IMPORT_ITEM_REJECTED;
    await logActivity(prisma, {
      userId,
      action,
      entityType: ENTITY_TYPES.IMPORT_ITEM,
      entityId: itemId,
      metadata: { importId, decision, reason },
    });

    return decisionRecord;
  },

  /**
   * Finalize an import — create expenses from all approved items.
   * PLACEHOLDER: Expense creation from approved items will be implemented
   * after CSV format is known.
   */
  async finalizeImport(importId, userId) {
    const csvImport = await this.getImportById(importId, userId);

    if (csvImport.uploadedById !== userId) {
      const error = new Error('Only the uploader can finalize an import.');
      error.statusCode = 403;
      throw error;
    }

    if (csvImport.status !== IMPORT_STATUS.PENDING_REVIEW) {
      const error = new Error('This import is not ready for finalization.');
      error.statusCode = 400;
      throw error;
    }

    // Get all items and their statuses
    const items = await importsRepository.findItemsByImportId(importId);

    const approved = items.filter((i) => i.status === IMPORT_ITEM_STATUS.APPROVED);
    const rejected = items.filter((i) => i.status === IMPORT_ITEM_STATUS.REJECTED);
    const undecided = items.filter(
      (i) => i.status !== IMPORT_ITEM_STATUS.APPROVED
        && i.status !== IMPORT_ITEM_STATUS.REJECTED
        && i.status !== IMPORT_ITEM_STATUS.ERROR
    );

    if (undecided.length > 0) {
      const error = new Error(
        `${undecided.length} items have not been reviewed yet. Please decide on all items before finalizing.`
      );
      error.statusCode = 400;
      throw error;
    }

    // TODO: Create expenses from approved items
    // This will be implemented after CSV format analysis

    // Update import status
    const finalStatus = rejected.length === 0
      ? IMPORT_STATUS.COMPLETED
      : IMPORT_STATUS.PARTIALLY_COMPLETED;

    await importsRepository.updateStatus(importId, {
      status: finalStatus,
      approvedRows: approved.length,
      rejectedRows: rejected.length,
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.IMPORT_FINALIZED,
      entityType: ENTITY_TYPES.IMPORT,
      entityId: importId,
      metadata: { approved: approved.length, rejected: rejected.length },
    });

    return {
      status: finalStatus,
      approved: approved.length,
      rejected: rejected.length,
    };
  },

  /**
   * Get decision log for an import.
   */
  async getImportDecisions(importId, userId) {
    await this.getImportById(importId, userId);
    return importsRepository.getDecisionsByImportId(importId);
  },

  /**
   * Generate import report.
   * PLACEHOLDER: Will be enhanced after CSV format analysis.
   */
  async generateReport(importId, userId) {
    const csvImport = await this.getImportById(importId, userId);
    const items = await importsRepository.findItemsByImportId(importId);
    const decisions = await importsRepository.getDecisionsByImportId(importId);

    return {
      import: csvImport,
      summary: {
        totalRows: csvImport.totalRows,
        validRows: csvImport.validRows,
        flaggedRows: csvImport.flaggedRows,
        approvedRows: csvImport.approvedRows,
        rejectedRows: csvImport.rejectedRows,
      },
      items: items.map((item) => ({
        rowNumber: item.rowNumber,
        status: item.status,
        rawData: item.rawData,
        anomalies: item.anomalyFlags,
        decisions: item.decisions,
      })),
      decisionLog: decisions,
    };
  },
};

module.exports = importsService;
