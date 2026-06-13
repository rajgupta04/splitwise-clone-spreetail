const fs = require('fs');
const prisma = require('../../config/database');
const importsRepository = require('./imports.repository');
const { logActivity } = require('../../utils/activityLogger');
const currencyService = require('../currency/currency.service');
const detectors = require('./anomaly-detectors');
const {
  ACTIVITY_ACTIONS, ENTITY_TYPES, IMPORT_STATUS,
  IMPORT_ITEM_STATUS, ANOMALY_SEVERITY, ANOMALY_TYPES, SPLIT_TYPES,
  SPLIT_TYPE_ALIASES,
} = require('../../config/constants');

/**
 * Parse a CSV string into rows of objects.
 * Handles quoted fields with commas inside.
 */
function parseCSVString(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    row._rowNumber = i + 1; // 1-indexed, accounting for header
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse split_details string into structured data.
 * Examples:
 *   "Rohan 700; Priya 400; Meera 400" → [{ name: "Rohan", value: 700 }, ...]
 *   "Aisha 30%; Rohan 30%; ..." → [{ name: "Aisha", value: 30 }, ...]
 *   "Aisha 1; Rohan 2; ..." → [{ name: "Aisha", value: 1 }, ...]
 */
function parseSplitDetails(detailsStr) {
  if (!detailsStr || !detailsStr.trim()) return [];
  const parts = detailsStr.split(';').map((s) => s.trim()).filter(Boolean);
  return parts.map((part) => {
    const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
    if (match) {
      return { name: match[1].trim(), value: parseFloat(match[2]) };
    }
    return { name: part, value: null };
  });
}

const importsService = {
  /**
   * Upload a CSV file, parse it, detect anomalies, and create import items.
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

    // Read and parse CSV file
    const filePath = file.path;
    const content = fs.readFileSync(filePath, 'utf-8');
    const csvRows = parseCSVString(content);

    if (csvRows.length === 0) {
      const error = new Error('CSV file is empty or has no data rows.');
      error.statusCode = 400;
      throw error;
    }

    // Get all registered users and memberships for detection
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
    const allMemberships = await prisma.groupMembership.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Phase 1: Parse each row
    const parsedRows = csvRows.map((raw) => {
      const dateResult = detectors.parseDate(raw.date, raw._rowNumber);
      const amountResult = detectors.parseAmount(raw.amount);
      return {
        rowNumber: raw._rowNumber,
        raw,
        parsedDate: dateResult.date,
        parsedAmount: amountResult.amount,
        dateAnomalies: dateResult.anomalies,
        amountAnomalies: amountResult.anomalies,
      };
    });

    // Phase 2: Cross-row duplicate detection
    const duplicateMap = detectors.detectDuplicates(parsedRows);

    // Phase 3: Per-row anomaly detection
    const importItems = parsedRows.map((parsed, idx) => {
      const anomalies = [
        ...parsed.dateAnomalies,
        ...parsed.amountAnomalies,
        ...detectors.detectMissingPayer(parsed.raw),
        ...detectors.detectPayerNameIssues(parsed.raw, allUsers),
        ...detectors.detectMissingCurrency(parsed.raw, group.baseCurrency),
        ...detectors.detectSettlement(parsed.raw),
        ...detectors.detectUnknownParticipants(parsed.raw, allUsers),
        ...detectors.detectMembershipViolation(parsed.raw, parsed.parsedDate, allMemberships),
        ...detectors.detectInvalidPercentageSplit(parsed.raw),
        ...detectors.detectConflictingSplitData(parsed.raw),
        ...detectors.detectFutureDated(parsed.parsedDate),
        ...(duplicateMap.get(idx) || []),
      ];

      const hasErrors = anomalies.some((a) => a.severity === ANOMALY_SEVERITY.ERROR);
      const status = hasErrors
        ? IMPORT_ITEM_STATUS.ERROR
        : anomalies.length > 0
          ? IMPORT_ITEM_STATUS.FLAGGED
          : IMPORT_ITEM_STATUS.CLEAN;

      // Build parsed data
      const payerMatch = detectors.fuzzyMatchUser(parsed.raw.paid_by, allUsers);
      const currency = (parsed.raw.currency || '').trim() || group.baseCurrency;
      const rawSplitType = (parsed.raw.split_type || '').trim().toLowerCase();
      const mappedSplitType = SPLIT_TYPE_ALIASES[rawSplitType] || rawSplitType;
      const isSettlement = anomalies.some((a) => a.type === 'settlement_as_expense');

      const parsedData = {
        date: parsed.parsedDate ? parsed.parsedDate.toISOString().split('T')[0] : null,
        description: (parsed.raw.description || '').trim(),
        paidBy: payerMatch.matched ? payerMatch.user.name : (parsed.raw.paid_by || '').trim(),
        paidByUserId: payerMatch.matched ? payerMatch.user.id : null,
        amount: parsed.parsedAmount,
        currency,
        splitType: mappedSplitType || null,
        splitWith: (parsed.raw.split_with || '').split(';').map((s) => s.trim()).filter(Boolean),
        splitDetails: parseSplitDetails(parsed.raw.split_details),
        notes: (parsed.raw.notes || '').trim(),
        isSettlement,
      };

      return {
        rowNumber: parsed.rowNumber,
        rawData: parsed.raw,
        parsedData,
        status,
        anomalies,
      };
    });

    // Create import record and items in a transaction
    const csvImport = await prisma.$transaction(async (tx) => {
      const imp = await tx.csvImport.create({
        data: {
          groupId,
          uploadedById: userId,
          fileName: file.originalname,
          status: IMPORT_STATUS.PENDING_REVIEW,
          totalRows: importItems.length,
          validRows: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.CLEAN).length,
          flaggedRows: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.FLAGGED).length,
        },
      });

      for (const item of importItems) {
        const createdItem = await tx.importItem.create({
          data: {
            importId: imp.id,
            rowNumber: item.rowNumber,
            rawData: item.rawData,
            parsedData: item.parsedData,
            status: item.status,
          },
        });

        // Create anomaly flags
        for (const anomaly of item.anomalies) {
          await tx.anomalyFlag.create({
            data: {
              importItemId: createdItem.id,
              anomalyType: anomaly.type,
              severity: anomaly.severity,
              details: anomaly.details,
            },
          });
        }
      }

      return imp;
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.IMPORT_UPLOADED,
      entityType: ENTITY_TYPES.IMPORT,
      entityId: csvImport.id,
      metadata: {
        fileName: file.originalname,
        groupId,
        totalRows: importItems.length,
        clean: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.CLEAN).length,
        flagged: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.FLAGGED).length,
        errors: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.ERROR).length,
      },
    });

    return {
      ...csvImport,
      summary: {
        total: importItems.length,
        clean: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.CLEAN).length,
        flagged: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.FLAGGED).length,
        errors: importItems.filter((i) => i.status === IMPORT_ITEM_STATUS.ERROR).length,
      },
    };
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
   * Finalize an import — create expenses/settlements from all approved items.
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

    const group = await prisma.group.findUnique({ where: { id: csvImport.groupId } });
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true } });

    // Get all items
    const items = await importsRepository.findItemsByImportId(importId);

    const approved = items.filter((i) => i.status === IMPORT_ITEM_STATUS.APPROVED || i.status === IMPORT_ITEM_STATUS.CLEAN);
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

    // Create expenses/settlements from approved items
    let createdExpenses = 0;
    let createdSettlements = 0;

    for (const item of approved) {
      const parsed = item.parsedData;
      if (!parsed || !parsed.paidByUserId || !parsed.date) {
        await importsRepository.updateItemStatus(item.id, IMPORT_ITEM_STATUS.FAILED);
        await importsRepository.createAnomalyFlag({
          importItemId: item.id,
          anomalyType: ANOMALY_TYPES.FINALIZATION_ERROR,
          severity: ANOMALY_SEVERITY.ERROR,
          details: !parsed ? 'Failed to import: Missing parsed data' : (!parsed.paidByUserId ? `Failed to import: Unknown payer "${parsed.paidBy || ''}"` : 'Failed to import: Missing date'),
        });
        continue;
      }

      // Determine exchange rate for non-base currencies
      let exchangeRate = 1;
      let normalizedAmount = Math.abs(parsed.amount);
      const currency = parsed.currency || group.baseCurrency;

      if (currency !== group.baseCurrency) {
        try {
          exchangeRate = await currencyService.getExchangeRate(currency, group.baseCurrency, parsed.date);
          normalizedAmount = currencyService.convertAmount(Math.abs(parsed.amount), exchangeRate);
        } catch (e) {
          // Fallback: use amount as-is
          exchangeRate = 1;
          normalizedAmount = Math.abs(parsed.amount);
        }
      }

      if (parsed.isSettlement) {
        // Create a settlement record
        const recipientName = parsed.splitWith[0];
        const recipientMatch = detectors.fuzzyMatchUser(recipientName, allUsers);

        if (!recipientMatch.matched) {
          await importsRepository.updateItemStatus(item.id, IMPORT_ITEM_STATUS.FAILED);
          await importsRepository.createAnomalyFlag({
            importItemId: item.id,
            anomalyType: ANOMALY_TYPES.FINALIZATION_ERROR,
            severity: ANOMALY_SEVERITY.ERROR,
            details: `Failed to import: Unknown settlement recipient "${recipientName}"`,
          });
          continue;
        }

        const recipientId = recipientMatch.user.id;

        await prisma.$transaction(async (tx) => {
          await tx.settlement.create({
            data: {
              groupId: csvImport.groupId,
              payerId: parsed.paidByUserId,
              payeeId: recipientId,
              originalAmount: Math.abs(parsed.amount),
              originalCurrency: group.baseCurrency,
              exchangeRate: 1,
              normalizedAmount,
              settlementDate: new Date(parsed.date),
              createdById: userId,
            },
          });

          await tx.importItem.update({
            where: { id: item.id },
            data: { status: IMPORT_ITEM_STATUS.IMPORTED },
          });
        });

        createdSettlements++;
      } else {
        // Create an expense with splits
        const splitType = parsed.splitType || SPLIT_TYPES.EQUAL;
        const participants = parsed.splitWith
          .map((name) => detectors.fuzzyMatchUser(name, allUsers))
          .filter((m) => m.matched)
          .map((m) => m.user);

        if (participants.length === 0) {
          await importsRepository.updateItemStatus(item.id, IMPORT_ITEM_STATUS.FAILED);
          await importsRepository.createAnomalyFlag({
            importItemId: item.id,
            anomalyType: ANOMALY_TYPES.FINALIZATION_ERROR,
            severity: ANOMALY_SEVERITY.ERROR,
            details: 'Failed to import: No recognized participants for split',
          });
          continue;
        }

        const amount = parsed.amount < 0 ? parsed.amount : parsed.amount; // preserve sign for refunds
        const absAmount = Math.abs(amount);

        // Calculate splits
        const splitsData = this._calculateSplits(
          splitType, absAmount, normalizedAmount, exchangeRate,
          participants, parsed.splitDetails
        );

        // Handle negative amounts (refunds): invert the split amounts
        if (amount < 0) {
          splitsData.forEach((s) => {
            s.originalAmount = -Math.abs(s.originalAmount);
            s.normalizedAmount = -Math.abs(s.normalizedAmount);
          });
        }

        await prisma.$transaction(async (tx) => {
          const expense = await tx.expense.create({
            data: {
              groupId: csvImport.groupId,
              paidById: parsed.paidByUserId,
              description: parsed.description,
              originalAmount: amount,
              originalCurrency: currency,
              exchangeRate,
              normalizedAmount: amount < 0 ? -normalizedAmount : normalizedAmount,
              splitType,
              expenseDate: new Date(parsed.date),
              createdById: userId,
              importItemId: item.id,
            },
          });

          for (const split of splitsData) {
            await tx.expenseSplit.create({
              data: {
                expenseId: expense.id,
                userId: split.userId,
                originalAmount: split.originalAmount,
                normalizedAmount: split.normalizedAmount,
                percentage: split.percentage || null,
                shares: split.shares || null,
              },
            });
          }

          await tx.importItem.update({
            where: { id: item.id },
            data: { status: IMPORT_ITEM_STATUS.IMPORTED },
          });
        });
        createdExpenses++;
      }
    }

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
      metadata: {
        approved: approved.length,
        rejected: rejected.length,
        createdExpenses,
        createdSettlements,
      },
    });

    return {
      status: finalStatus,
      approved: approved.length,
      rejected: rejected.length,
      createdExpenses,
      createdSettlements,
    };
  },

  /**
   * Calculate splits for an imported expense.
   */
  _calculateSplits(splitType, originalAmount, normalizedAmount, exchangeRate, participants, splitDetails) {
    const count = participants.length;

    switch (splitType) {
      case SPLIT_TYPES.EQUAL: {
        const perPerson = Math.floor((originalAmount * 100) / count) / 100;
        const remainder = Math.round((originalAmount - perPerson * count) * 100);
        return participants.map((user, idx) => {
          const extra = idx < remainder ? 0.01 : 0;
          const orig = perPerson + extra;
          return {
            userId: user.id,
            originalAmount: orig,
            normalizedAmount: Math.round(orig * exchangeRate * 100) / 100,
          };
        });
      }

      case SPLIT_TYPES.EXACT: {
        return participants.map((user) => {
          const detail = splitDetails.find((d) =>
            detectors.normalizeName(d.name) === detectors.normalizeName(user.name)
          );
          const orig = detail ? detail.value : 0;
          return {
            userId: user.id,
            originalAmount: orig,
            normalizedAmount: Math.round(orig * exchangeRate * 100) / 100,
          };
        });
      }

      case SPLIT_TYPES.PERCENTAGE: {
        // If percentages don't sum to 100, normalize them
        let totalPct = splitDetails.reduce((sum, d) => sum + (d.value || 0), 0);
        if (totalPct === 0) totalPct = 100;

        return participants.map((user) => {
          const detail = splitDetails.find((d) =>
            detectors.normalizeName(d.name) === detectors.normalizeName(user.name)
          );
          const rawPct = detail ? detail.value : 0;
          const normalizedPct = (rawPct / totalPct) * 100;
          const orig = Math.round((originalAmount * normalizedPct / 100) * 100) / 100;
          return {
            userId: user.id,
            originalAmount: orig,
            normalizedAmount: Math.round(orig * exchangeRate * 100) / 100,
            percentage: Math.round(normalizedPct * 100) / 100,
          };
        });
      }

      case SPLIT_TYPES.SHARES: {
        const totalShares = splitDetails.reduce((sum, d) => sum + (d.value || 0), 0) || count;
        return participants.map((user) => {
          const detail = splitDetails.find((d) =>
            detectors.normalizeName(d.name) === detectors.normalizeName(user.name)
          );
          const userShares = detail ? detail.value : 1;
          const orig = Math.round((originalAmount * userShares / totalShares) * 100) / 100;
          return {
            userId: user.id,
            originalAmount: orig,
            normalizedAmount: Math.round(orig * exchangeRate * 100) / 100,
            shares: userShares,
          };
        });
      }

      default: {
        // Fallback to equal
        const perPerson = Math.round((originalAmount / count) * 100) / 100;
        return participants.map((user) => ({
          userId: user.id,
          originalAmount: perPerson,
          normalizedAmount: Math.round(perPerson * exchangeRate * 100) / 100,
        }));
      }
    }
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
        parsedData: item.parsedData,
        anomalies: item.anomalyFlags,
        decisions: item.decisions,
      })),
      decisionLog: decisions,
    };
  },
};

module.exports = importsService;
