/**
 * Anomaly detection engine for CSV import.
 *
 * Each detector function takes a parsed row and context,
 * and returns an array of anomaly objects: { type, severity, details }
 */
const { ANOMALY_TYPES, ANOMALY_SEVERITY, SPLIT_TYPES } = require('../../config/constants');

// ─── NAME NORMALIZATION ──────────────────────────────────────────────────────

/**
 * Normalize a name for matching: trim, lowercase.
 */
function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * Attempt to fuzzy-match a name against a list of registered users.
 * Returns { matched: true, user } or { matched: false }.
 */
function fuzzyMatchUser(rawName, users) {
  const clean = normalizeName(rawName);
  if (!clean) return { matched: false };

  // 1. Exact match (case-insensitive)
  const exact = users.find((u) => normalizeName(u.name) === clean);
  if (exact) return { matched: true, user: exact };

  // 2. First-name prefix match (e.g. "Priya S" → "Priya")
  const firstName = clean.split(/\s+/)[0];
  const prefixMatch = users.find((u) => normalizeName(u.name) === firstName);
  if (prefixMatch) return { matched: true, user: prefixMatch, fuzzy: true };

  return { matched: false };
}

// ─── DATE PARSING ────────────────────────────────────────────────────────────

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parse a date string. Returns { date: Date|null, anomalies: [] }
 */
function parseDate(dateStr, rowNumber) {
  const anomalies = [];
  const trimmed = (dateStr || '').trim();

  // Try DD-MM-YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);

    // Ambiguous date check: both day and month ≤ 12 and day ≠ month
    if (d <= 12 && m <= 12 && d !== m) {
      anomalies.push({
        type: ANOMALY_TYPES.AMBIGUOUS_DATE,
        severity: ANOMALY_SEVERITY.WARNING,
        details: `Date "${trimmed}" is ambiguous: could be ${day}/${month}/${year} (DD-MM) or ${month}/${day}/${year} (MM-DD). Parsed as DD-MM-YYYY.`,
      });
    }

    const parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    if (!isNaN(parsed.getTime())) {
      return { date: parsed, anomalies };
    }
  }

  // Try Mon-DD (e.g. "Mar-14")
  const monDD = trimmed.match(/^([A-Za-z]{3})-(\d{1,2})$/);
  if (monDD) {
    const [, monthAbbr, day] = monDD;
    const monthNum = MONTH_MAP[monthAbbr.toLowerCase()];
    if (monthNum) {
      // Infer year as 2026 (from surrounding context)
      const year = '2026';
      anomalies.push({
        type: ANOMALY_TYPES.INVALID_DATE,
        severity: ANOMALY_SEVERITY.WARNING,
        details: `Date "${trimmed}" uses non-standard format (Mon-DD). No year specified. Interpreted as ${day.padStart(2, '0')}-${monthNum}-${year}.`,
      });
      const parsed = new Date(`${year}-${monthNum}-${day.padStart(2, '0')}T00:00:00Z`);
      if (!isNaN(parsed.getTime())) {
        return { date: parsed, anomalies };
      }
    }
  }

  // Unparseable
  anomalies.push({
    type: ANOMALY_TYPES.INVALID_DATE,
    severity: ANOMALY_SEVERITY.ERROR,
    details: `Date "${trimmed}" could not be parsed. Expected DD-MM-YYYY format.`,
  });
  return { date: null, anomalies };
}

// ─── AMOUNT PARSING ──────────────────────────────────────────────────────────

/**
 * Parse an amount string. Returns { amount: number|null, anomalies: [] }
 */
function parseAmount(amountStr) {
  const anomalies = [];
  let cleaned = (amountStr || '').trim();

  // Strip commas (thousands separator)
  if (cleaned.includes(',')) {
    anomalies.push({
      type: ANOMALY_TYPES.FORMAT_ERROR,
      severity: ANOMALY_SEVERITY.INFO,
      details: `Amount "${cleaned}" contains comma formatting. Stripped to "${cleaned.replace(/,/g, '')}".`,
    });
    cleaned = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    anomalies.push({
      type: ANOMALY_TYPES.MISSING_FIELDS,
      severity: ANOMALY_SEVERITY.ERROR,
      details: `Amount "${amountStr}" is not a valid number.`,
    });
    return { amount: null, anomalies };
  }

  // Check zero
  if (num === 0) {
    anomalies.push({
      type: ANOMALY_TYPES.ZERO_AMOUNT,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `Amount is ₹0. This expense has no financial impact.`,
    });
  }

  // Check negative
  if (num < 0) {
    anomalies.push({
      type: ANOMALY_TYPES.NEGATIVE_AMOUNT,
      severity: ANOMALY_SEVERITY.INFO,
      details: `Amount is negative (${num}). Treated as a refund/credit.`,
    });
  }

  // Check 3+ decimal places
  const decimalParts = cleaned.split('.');
  if (decimalParts.length === 2 && decimalParts[1].length > 2) {
    const rounded = Math.round(num * 100) / 100;
    anomalies.push({
      type: ANOMALY_TYPES.ROUNDING_ISSUE,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `Amount "${cleaned}" has ${decimalParts[1].length} decimal places. Rounded to ${rounded.toFixed(2)}.`,
    });
    return { amount: rounded, anomalies };
  }

  return { amount: num, anomalies };
}

// ─── ROW-LEVEL DETECTORS ─────────────────────────────────────────────────────

/**
 * Detect missing payer.
 */
function detectMissingPayer(row) {
  if (!row.paid_by || !row.paid_by.trim()) {
    return [{
      type: ANOMALY_TYPES.MISSING_FIELDS,
      severity: ANOMALY_SEVERITY.ERROR,
      details: `Payer (paid_by) is missing. Cannot create expense without a payer.`,
    }];
  }
  return [];
}

/**
 * Detect payer name issues (case mismatch, suffix).
 */
function detectPayerNameIssues(row, users) {
  const raw = (row.paid_by || '').trim();
  if (!raw) return []; // handled by detectMissingPayer

  const match = fuzzyMatchUser(raw, users);
  if (match.matched && match.fuzzy) {
    return [{
      type: ANOMALY_TYPES.NAME_MISMATCH,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `Payer "${raw}" fuzzy-matched to "${match.user.name}".`,
    }];
  }
  if (match.matched && normalizeName(raw) === normalizeName(match.user.name) && raw !== match.user.name) {
    return [{
      type: ANOMALY_TYPES.NAME_MISMATCH,
      severity: ANOMALY_SEVERITY.INFO,
      details: `Payer "${raw}" normalized to "${match.user.name}" (case mismatch).`,
    }];
  }
  if (!match.matched) {
    return [{
      type: ANOMALY_TYPES.UNKNOWN_PARTICIPANT,
      severity: ANOMALY_SEVERITY.ERROR,
      details: `Payer "${raw}" does not match any registered user.`,
    }];
  }
  return [];
}

/**
 * Detect missing currency.
 */
function detectMissingCurrency(row, groupCurrency) {
  if (!row.currency || !row.currency.trim()) {
    return [{
      type: ANOMALY_TYPES.MISSING_CURRENCY,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `Currency is missing. Defaulting to group base currency (${groupCurrency}).`,
    }];
  }
  return [];
}

/**
 * Detect settlement logged as expense.
 */
function detectSettlement(row) {
  const desc = (row.description || '').toLowerCase();
  const splitWith = (row.split_with || '').split(';').map((s) => s.trim()).filter(Boolean);
  const splitType = (row.split_type || '').trim();

  const settlementKeywords = ['paid back', 'paid .* back', 'settlement', 'reimburse', 'deposit', 'transfer'];
  const isSettlementDescription = settlementKeywords.some((kw) => new RegExp(kw).test(desc));

  // Single recipient + settlement keywords, or empty split type with single recipient
  if (splitWith.length === 1 && (isSettlementDescription || !splitType)) {
    return [{
      type: ANOMALY_TYPES.SETTLEMENT_AS_EXPENSE,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `"${row.description}" appears to be a settlement/transfer (single recipient: ${splitWith[0]}), not a shared expense.`,
    }];
  }
  return [];
}

/**
 * Detect unknown participants in split_with.
 */
function detectUnknownParticipants(row, users) {
  const anomalies = [];
  const splitWith = (row.split_with || '').split(';').map((s) => s.trim()).filter(Boolean);

  for (const name of splitWith) {
    const match = fuzzyMatchUser(name, users);
    if (!match.matched) {
      anomalies.push({
        type: ANOMALY_TYPES.UNKNOWN_PARTICIPANT,
        severity: ANOMALY_SEVERITY.ERROR,
        details: `Participant "${name}" does not match any registered user.`,
      });
    }
  }
  return anomalies;
}

/**
 * Detect membership violations (participant left before expense date).
 */
function detectMembershipViolation(row, parsedDate, memberships) {
  if (!parsedDate) return [];
  const anomalies = [];
  const splitWith = (row.split_with || '').split(';').map((s) => s.trim()).filter(Boolean);
  const expenseDate = new Date(parsedDate);

  for (const name of splitWith) {
    const membership = memberships.find(
      (m) => normalizeName(m.user.name) === normalizeName(name) || normalizeName(name).startsWith(normalizeName(m.user.name))
    );
    if (membership && membership.leftAt) {
      const leftDate = new Date(membership.leftAt);
      if (leftDate < expenseDate) {
        anomalies.push({
          type: ANOMALY_TYPES.MEMBERSHIP_VIOLATION,
          severity: ANOMALY_SEVERITY.WARNING,
          details: `"${name}" left the group on ${leftDate.toISOString().split('T')[0]} but is included in this expense dated ${expenseDate.toISOString().split('T')[0]}.`,
        });
      }
    }
  }
  return anomalies;
}

/**
 * Detect invalid percentage splits (don't sum to 100%).
 */
function detectInvalidPercentageSplit(row) {
  if ((row.split_type || '').trim().toLowerCase() !== 'percentage') return [];
  const details = (row.split_details || '').trim();
  if (!details) return [];

  const parts = details.split(';').map((s) => s.trim());
  let total = 0;
  for (const part of parts) {
    const match = part.match(/([\d.]+)%/);
    if (match) total += parseFloat(match[1]);
  }

  if (Math.abs(total - 100) > 0.01) {
    return [{
      type: ANOMALY_TYPES.INVALID_SPLIT,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `Percentages sum to ${total}% instead of 100%. Details: "${row.split_details}".`,
    }];
  }
  return [];
}

/**
 * Detect conflicting split type vs split details.
 */
function detectConflictingSplitData(row) {
  const splitType = (row.split_type || '').trim().toLowerCase();
  const details = (row.split_details || '').trim();

  if (splitType === 'equal' && details) {
    return [{
      type: ANOMALY_TYPES.CONFLICTING_SPLIT_DATA,
      severity: ANOMALY_SEVERITY.INFO,
      details: `Split type is "equal" but split_details contains data: "${details}". Details will be ignored.`,
    }];
  }
  return [];
}

/**
 * Detect future-dated expenses.
 */
function detectFutureDated(parsedDate) {
  if (!parsedDate) return [];
  if (new Date(parsedDate) > new Date()) {
    return [{
      type: ANOMALY_TYPES.FUTURE_DATED,
      severity: ANOMALY_SEVERITY.WARNING,
      details: `Expense is dated in the future (${new Date(parsedDate).toISOString().split('T')[0]}).`,
    }];
  }
  return [];
}

// ─── CROSS-ROW DETECTORS ─────────────────────────────────────────────────────

/**
 * Detect duplicate expenses across all rows.
 * Returns a Map of rowIndex → anomaly[] for flagged rows.
 */
function detectDuplicates(allParsedRows) {
  const duplicateAnomalies = new Map();

  for (let i = 0; i < allParsedRows.length; i++) {
    for (let j = i + 1; j < allParsedRows.length; j++) {
      const a = allParsedRows[i];
      const b = allParsedRows[j];

      if (!a.parsedDate || !b.parsedDate) continue;
      if (a.parsedDate.getTime() !== b.parsedDate.getTime()) continue;

      // Same date — check for duplicate indicators
      const sameAmount = a.parsedAmount === b.parsedAmount;
      const samePayer = normalizeName(a.raw.paid_by) === normalizeName(b.raw.paid_by);
      const descA = normalizeName(a.raw.description).replace(/[^a-z0-9\s]/g, '');
      const descB = normalizeName(b.raw.description).replace(/[^a-z0-9\s]/g, '');
      const similarDesc = descA.includes(descB) || descB.includes(descA) ||
        descA.split(/\s+/).filter((w) => descB.includes(w)).length >= 2;

      if (similarDesc && (sameAmount || samePayer)) {
        const detail = sameAmount && samePayer
          ? `Row ${a.rowNumber} and Row ${b.rowNumber}: Same date, payer, and amount (${a.parsedAmount}). Descriptions: "${a.raw.description}" vs "${b.raw.description}".`
          : `Row ${a.rowNumber} and Row ${b.rowNumber}: Same date, similar descriptions. Different ${!sameAmount ? 'amounts' : 'payers'}: ${a.raw.paid_by}/${a.parsedAmount} vs ${b.raw.paid_by}/${b.parsedAmount}.`;

        // Flag the later row
        if (!duplicateAnomalies.has(j)) duplicateAnomalies.set(j, []);
        duplicateAnomalies.get(j).push({
          type: ANOMALY_TYPES.DUPLICATE_EXPENSE,
          severity: ANOMALY_SEVERITY.WARNING,
          details: detail,
        });
      }
    }
  }

  return duplicateAnomalies;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

module.exports = {
  normalizeName,
  fuzzyMatchUser,
  parseDate,
  parseAmount,
  detectMissingPayer,
  detectPayerNameIssues,
  detectMissingCurrency,
  detectSettlement,
  detectUnknownParticipants,
  detectMembershipViolation,
  detectInvalidPercentageSplit,
  detectConflictingSplitData,
  detectFutureDated,
  detectDuplicates,
};
