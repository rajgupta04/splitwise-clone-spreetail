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
      const amountResult = detectors.parseAmount(raw.amount, raw);
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

      // Clean items auto-resolve (no anomalies to decide on)
      const importStatus = status === IMPORT_ITEM_STATUS.CLEAN ? 'resolved' : 'pending';

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
        importStatus,
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
            importStatus: item.importStatus,
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
              meta: anomaly.meta || {},
              resolutionOptions: anomaly.resolutionOptions || [],
              defaultResolution: anomaly.defaultResolution || null,
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
   * Resolve a single import item's anomaly with structured resolution data.
   */
  async resolveItem(importId, itemId, userId, { resolutionType, resolutionData, anomalyId }) {
    const csvImport = await this.getImportById(importId, userId);

    // Only the uploader can resolve
    if (csvImport.uploadedById !== userId) {
      const error = new Error('Only the uploader can resolve import items.');
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

    // Determine import_status based on resolution type
    const skipResolutions = ['skip', 'reject', 'reject_row'];
    let importStatus = skipResolutions.includes(resolutionType) ? 'skipped' : 'resolved';

    let finalResType = resolutionType;
    let finalResData = resolutionData || {};

    if (anomalyId && item.anomalyFlags.length > 1) {
      // If ANY anomaly is skipped/rejected, the whole row is skipped
      if (importStatus === 'skipped') {
        finalResType = resolutionType;
        finalResData = resolutionData || {};
      } else {
        finalResType = 'compound';
        const existingCompound = item.resolutionType === 'compound' ? (item.resolutionData?.resolutions || {}) : {};
        existingCompound[anomalyId] = { type: resolutionType, data: resolutionData || {} };
        finalResData = { resolutions: existingCompound };

        const resolvedCount = Object.keys(existingCompound).length;
        if (resolvedCount < item.anomalyFlags.length) {
           importStatus = 'pending'; // Still waiting for other anomalies
        }
      }
    }

    // Update the item with resolution data
    const updatedItem = await importsRepository.resolveItem(itemId, {
      resolutionType: finalResType,
      resolutionData: finalResData,
      resolvedById: userId,
      importStatus,
    });

    // Log activity
    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.IMPORT_ITEM_RESOLVED,
      entityType: ENTITY_TYPES.IMPORT_ITEM,
      entityId: itemId,
      metadata: { importId, resolutionType: finalResType, resolutionData: finalResData },
    });

    return updatedItem;
  },

  /**
   * Execute an import — create expenses/settlements from all resolved items
   * using their resolution_data for decisions.
   */
  async executeImport(importId, userId) {
    const csvImport = await this.getImportById(importId, userId);

    if (csvImport.uploadedById !== userId) {
      const error = new Error('Only the uploader can execute an import.');
      error.statusCode = 403;
      throw error;
    }

    if (csvImport.status !== IMPORT_STATUS.PENDING_REVIEW) {
      const error = new Error('This import is not ready for execution.');
      error.statusCode = 400;
      throw error;
    }

    // Get all items
    const items = await importsRepository.findItemsByImportId(importId);

    // We allow partial execution now, but we only process items that haven't been imported yet
    const pendingItems = items.filter((i) => i.importStatus === 'pending');

    const group = await prisma.group.findUnique({ where: { id: csvImport.groupId } });
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
    const allMemberships = await prisma.groupMembership.findMany({
      where: { groupId: csvImport.groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const resolvedItems = items.filter((i) => i.importStatus === 'resolved' && i.status !== 'imported' && i.status !== 'failed');
    const skippedItems = items.filter((i) => i.importStatus === 'skipped' && i.status !== 'imported' && i.status !== 'failed');

    let createdExpenses = 0;
    let createdSettlements = 0;
    const reportRows = [];

    // Build a set of row numbers that should be skipped due to duplicate resolution
    const skipDueToDuplicate = new Set();
    for (const item of items) {
      if (item.resolutionType === 'keep_first' || item.resolutionType === 'keep_second') {
        // Find the anomaly flag for duplicate_expense to get the row info
        const dupFlag = item.anomalyFlags.find((f) => f.anomalyType === ANOMALY_TYPES.DUPLICATE_EXPENSE);
        if (dupFlag && item.resolutionData) {
          const keepRow = item.resolutionType === 'keep_first'
            ? item.resolutionData.keepRowNumber || item.resolutionData.rowA
            : item.resolutionData.keepRowNumber || item.resolutionData.rowB;
          const discardRow = item.resolutionType === 'keep_first'
            ? item.resolutionData.discardRowNumber || item.resolutionData.rowB
            : item.resolutionData.discardRowNumber || item.resolutionData.rowA;
          if (discardRow) {
            skipDueToDuplicate.add(typeof discardRow === 'object' ? discardRow : discardRow);
          }
        }
      }
    }

    // Process skipped items for reporting
    for (const item of skippedItems) {
      for (const flag of item.anomalyFlags) {
        reportRows.push({
          importId,
          rowNumber: item.rowNumber,
          originalValue: item.rawData,
          detectedIssue: `${flag.anomalyType} — ${flag.details}`,
          userDecision: `${item.resolutionType}: ${JSON.stringify(item.resolutionData || {})}`,
          finalValue: { status: 'SKIPPED', reason: item.resolutionType },
        });
      }
      if (item.anomalyFlags.length === 0) {
        reportRows.push({
          importId,
          rowNumber: item.rowNumber,
          originalValue: item.rawData,
          detectedIssue: 'skipped',
          userDecision: `${item.resolutionType}: ${JSON.stringify(item.resolutionData || {})}`,
          finalValue: { status: 'SKIPPED', reason: item.resolutionType },
        });
      }
    }

    // Process resolved items
    for (const item of resolvedItems) {
      const parsed = { ...(item.parsedData || {}) };
      const resData = item.resolutionData || {};
      const resType = item.resolutionType;

      // Apply resolution overrides to parsed data
      if (resType === 'compound') {
        const resolutionsMap = resData.resolutions || {};
        for (const flag of item.anomalyFlags) {
          const subRes = resolutionsMap[flag.id];
          if (subRes) {
            this._applyResolutions(parsed, item, subRes.type, subRes.data, allUsers, allMemberships, group);
          }
        }
      } else {
        this._applyResolutions(parsed, item, resType, resData, allUsers, allMemberships, group);
      }

      if (!parsed.paidByUserId || !parsed.date) {
        await importsRepository.updateItemStatus(item.id, IMPORT_ITEM_STATUS.FAILED);
        for (const flag of item.anomalyFlags) {
          let specificResType = resType;
          let specificResData = resData;
          if (resType === 'compound') {
            const subRes = (resData.resolutions || {})[flag.id];
            specificResType = subRes ? subRes.type : 'pending';
            specificResData = subRes ? subRes.data : {};
          }
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: `${flag.anomalyType} — ${flag.details}`,
            userDecision: `${specificResType}: ${JSON.stringify(specificResData)}`,
            finalValue: { status: 'FAILED', reason: !parsed.paidByUserId ? `Unknown payer "${parsed.paidBy || ''}"` : 'Missing date' },
          });
        }
        continue;
      }

      // Determine exchange rate for non-base currencies
      let exchangeRate = 1;
      let normalizedAmount = Math.abs(parsed.amount);
      const currency = parsed.currency || group.baseCurrency;

      if (currency !== group.baseCurrency) {
        try {
          // Check if user provided a manual exchange rate
          if (resData.exchangeRate) {
            exchangeRate = parseFloat(resData.exchangeRate);
            normalizedAmount = currencyService.convertAmount(Math.abs(parsed.amount), exchangeRate);
          } else {
            exchangeRate = await currencyService.getExchangeRate(currency, group.baseCurrency, parsed.date);
            normalizedAmount = currencyService.convertAmount(Math.abs(parsed.amount), exchangeRate);
          }
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
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: `unknown_recipient — ${recipientName}`,
            userDecision: `${resType}: ${JSON.stringify(resData)}`,
            finalValue: { status: 'FAILED', reason: `Unknown settlement recipient "${recipientName}"` },
          });
          continue;
        }

        const recipientId = recipientMatch.user.id;

        const settlement = await prisma.$transaction(async (tx) => {
          const s = await tx.settlement.create({
            data: {
              groupId: csvImport.groupId,
              payerId: parsed.paidByUserId,
              payeeId: recipientId,
              originalAmount: Math.abs(parsed.amount),
              originalCurrency: group.baseCurrency,
              exchangeRate: 1,
              normalizedAmount,
              settledAt: new Date(parsed.date),
              createdById: userId,
            },
          });

          await tx.importItem.update({
            where: { id: item.id },
            data: { status: IMPORT_ITEM_STATUS.IMPORTED },
          });

          return s;
        });

        createdSettlements++;
        for (const flag of item.anomalyFlags) {
          let specificResType = resType;
          let specificResData = resData;
          if (resType === 'compound') {
            const subRes = (resData.resolutions || {})[flag.id];
            specificResType = subRes ? subRes.type : 'pending';
            specificResData = subRes ? subRes.data : {};
          }
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: `${flag.anomalyType} — ${flag.details}`,
            userDecision: `${specificResType}: ${JSON.stringify(specificResData)}`,
            finalValue: { status: 'IMPORTED', type: 'settlement', id: settlement.id },
          });
        }
        if (item.anomalyFlags.length === 0) {
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: 'none',
            userDecision: 'auto-resolved (clean)',
            finalValue: { status: 'IMPORTED', type: 'settlement', id: settlement.id },
          });
        }
      } else {
        // Create an expense with splits
        const splitType = parsed.splitType || SPLIT_TYPES.EQUAL;
        const participants = parsed.splitWith
          .map((name) => detectors.fuzzyMatchUser(name, allUsers))
          .filter((m) => m.matched)
          .map((m) => m.user);

        if (participants.length === 0) {
          await importsRepository.updateItemStatus(item.id, IMPORT_ITEM_STATUS.FAILED);
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: 'no_participants',
            userDecision: `${resType}: ${JSON.stringify(resData)}`,
            finalValue: { status: 'FAILED', reason: 'No recognized participants for split' },
          });
          continue;
        }

        const amount = parsed.amount < 0 ? parsed.amount : parsed.amount; // preserve sign for refunds
        const absAmount = Math.abs(amount);

        // Handle negative amount resolution
        let effectiveAmount = amount;
        let effectiveNormalized = normalizedAmount;
        if (resType === 'as_positive' && amount < 0) {
          effectiveAmount = Math.abs(amount);
          effectiveNormalized = normalizedAmount;
        }

        // Calculate splits
        const splitsData = this._calculateSplits(
          splitType, absAmount, normalizedAmount, exchangeRate,
          participants, parsed.splitDetails
        );

        // Handle negative amounts (refunds): invert the split amounts
        if (effectiveAmount < 0) {
          splitsData.forEach((s) => {
            s.originalAmount = -Math.abs(s.originalAmount);
            s.normalizedAmount = -Math.abs(s.normalizedAmount);
          });
        }

        const expense = await prisma.$transaction(async (tx) => {
          const exp = await tx.expense.create({
            data: {
              groupId: csvImport.groupId,
              paidById: parsed.paidByUserId,
              description: parsed.description,
              originalAmount: effectiveAmount,
              originalCurrency: currency,
              exchangeRate,
              normalizedAmount: effectiveAmount < 0 ? -normalizedAmount : normalizedAmount,
              splitType,
              expenseDate: new Date(parsed.date),
              createdById: userId,
              importItemId: item.id,
            },
          });

          for (const split of splitsData) {
            await tx.expenseSplit.create({
              data: {
                expenseId: exp.id,
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

          return exp;
        });

        createdExpenses++;
        for (const flag of item.anomalyFlags) {
          let specificResType = resType;
          let specificResData = resData;
          if (resType === 'compound') {
            const subRes = (resData.resolutions || {})[flag.id];
            specificResType = subRes ? subRes.type : 'pending';
            specificResData = subRes ? subRes.data : {};
          }
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: `${flag.anomalyType} — ${flag.details}`,
            userDecision: `${specificResType}: ${JSON.stringify(specificResData)}`,
            finalValue: { status: 'IMPORTED', type: effectiveAmount < 0 ? 'refund' : 'expense', id: expense.id },
          });
        }
        if (item.anomalyFlags.length === 0) {
          reportRows.push({
            importId,
            rowNumber: item.rowNumber,
            originalValue: item.rawData,
            detectedIssue: 'none',
            userDecision: 'auto-resolved (clean)',
            finalValue: { status: 'IMPORTED', type: effectiveAmount < 0 ? 'refund' : 'expense', id: expense.id },
          });
        }
      }
    }

    // Write import report rows
    for (const row of reportRows) {
      await importsRepository.createImportReport(row);
    }

    // Update import status
    const finalStatus = skippedItems.length === 0
      ? IMPORT_STATUS.COMPLETED
      : IMPORT_STATUS.PARTIALLY_COMPLETED;

    await importsRepository.updateStatus(importId, {
      status: finalStatus,
      approvedRows: resolvedItems.length,
      rejectedRows: skippedItems.length,
    });

    await logActivity(prisma, {
      userId,
      action: ACTIVITY_ACTIONS.IMPORT_EXECUTED,
      entityType: ENTITY_TYPES.IMPORT,
      entityId: importId,
      metadata: {
        imported: createdExpenses + createdSettlements,
        skipped: skippedItems.length,
        createdExpenses,
        createdSettlements,
      },
    });

    return {
      imported: createdExpenses + createdSettlements,
      skipped: skippedItems.length,
      createdExpenses,
      createdSettlements,
      report: reportRows,
    };
  },

  /**
   * Apply resolution data overrides to parsed data before finalization.
   */
  _applyResolutions(parsed, item, resType, resData, allUsers, allMemberships, group) {
    for (const flag of item.anomalyFlags) {
      switch (flag.anomalyType) {
        case ANOMALY_TYPES.AMBIGUOUS_DATE:
          if (resData.confirmedDate) {
            parsed.date = resData.confirmedDate;
          }
          break;

        case ANOMALY_TYPES.INVALID_DATE:
          if (resData.confirmedDate) {
            parsed.date = resData.confirmedDate;
          }
          break;

        case ANOMALY_TYPES.NAME_MISMATCH:
        case ANOMALY_TYPES.UNKNOWN_PARTICIPANT:
          if ((resType === 'map' || resType === 'accept') && resData.selectedUserId) {
            const mappedUser = allUsers.find((u) => u.id === resData.selectedUserId);
            if (mappedUser) {
              const unknownName = resData.unknownName || '';
              if (flag.details.includes('Payer')) {
                parsed.paidBy = mappedUser.name;
                parsed.paidByUserId = mappedUser.id;
              } else {
                parsed.splitWith = parsed.splitWith.map((n) =>
                  detectors.normalizeName(n) === detectors.normalizeName(unknownName) ? mappedUser.name : n
                );
              }
            }
          } else if (resType === 'exclude') {
            const unknownName = resData.unknownName || '';
            parsed.splitWith = parsed.splitWith.filter(
              (n) => detectors.normalizeName(n) !== detectors.normalizeName(unknownName)
            );
          }
          break;

        case ANOMALY_TYPES.MEMBERSHIP_VIOLATION:
          if (resType === 'remove') {
            const violatingMember = resData.violatingMember || '';
            parsed.splitWith = parsed.splitWith.filter(
              (n) => detectors.normalizeName(n) !== detectors.normalizeName(violatingMember)
            );
          }
          break;

        case ANOMALY_TYPES.SETTLEMENT_AS_EXPENSE:
          if (resType === 'as_settlement') {
            parsed.isSettlement = true;
          } else if (resType === 'as_expense') {
            parsed.isSettlement = false;
          }
          break;

        case ANOMALY_TYPES.MISSING_FIELDS:
          if (resType === 'assign' && resData.selectedUserId) {
            const assignedUser = allUsers.find((u) => u.id === resData.selectedUserId);
            if (assignedUser) {
              parsed.paidBy = assignedUser.name;
              parsed.paidByUserId = assignedUser.id;
            }
          }
          break;

        case ANOMALY_TYPES.ROUNDING_ISSUE:
          if (resType === 'custom' && resData.correctedAmount != null) {
            parsed.amount = parseFloat(resData.correctedAmount);
          } else if (resType === 'accept_rounded' && resData.suggested != null) {
            parsed.amount = parseFloat(resData.suggested);
          }
          break;

        case ANOMALY_TYPES.MISSING_CURRENCY:
          if (resType === 'use_default') {
            parsed.currency = group.baseCurrency;
          } else if (resType === 'manual' && resData.currency) {
            parsed.currency = resData.currency;
          }
          break;

        case ANOMALY_TYPES.INVALID_SPLIT:
          if (resType === 'scale') {
            // Scale percentages proportionally handled by _calculateSplits
          } else if (resType === 'manual' && resData.adjustedPercentages) {
            // Override split details with user-provided percentages
            parsed.splitDetails = Object.entries(resData.adjustedPercentages).map(
              ([name, pct]) => ({ name, value: parseFloat(pct) })
            );
          }
          break;

        case ANOMALY_TYPES.NEGATIVE_AMOUNT:
          if (resType === 'as_positive') {
            parsed.amount = Math.abs(parsed.amount);
          }
          break;

        case ANOMALY_TYPES.CONFLICTING_SPLIT_DATA:
          if (resType === 'use_type') {
            // Keep splitType as-is (equal), ignore details
            parsed.splitDetails = [];
          } else if (resType === 'use_details') {
            // Override splitType to match the details (shares)
            parsed.splitType = SPLIT_TYPES.SHARES;
          }
          break;

        case ANOMALY_TYPES.ZERO_AMOUNT:
          if (resType === 'manual' && resData.correctedAmount != null) {
            parsed.amount = parseFloat(resData.correctedAmount);
          }
          break;

        case ANOMALY_TYPES.FORMAT_ERROR:
          if (resType === 'custom' && resData.correctedAmount != null) {
            parsed.amount = parseFloat(resData.correctedAmount);
          } else if (resType === 'accept' && resData.cleanedValue != null) {
            parsed.amount = parseFloat(resData.cleanedValue);
          }
          break;
      }
    }
  },

  /**
   * Finalize an import — create expenses/settlements from all approved items.
   * (Legacy method — kept for backward compatibility)
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
              settledAt: new Date(parsed.date),
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
    let finalStatus = csvImport.status;
    if (pendingItems.length === 0) {
      finalStatus = rejected.length === 0 ? IMPORT_STATUS.COMPLETED : IMPORT_STATUS.PARTIALLY_COMPLETED;
    }

    await importsRepository.updateStatus(importId, {
      status: finalStatus,
      approvedRows: (csvImport.approvedRows || 0) + approved.length,
      rejectedRows: (csvImport.rejectedRows || 0) + rejected.length,
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
    const reports = await importsRepository.findReportsByImportId(importId);

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
        importStatus: item.importStatus,
        rawData: item.rawData,
        parsedData: item.parsedData,
        anomalies: item.anomalyFlags,
        decisions: item.decisions,
        resolutionType: item.resolutionType,
        resolutionData: item.resolutionData,
      })),
      reports,
      decisionLog: decisions,
    };
  },
};

module.exports = importsService;
