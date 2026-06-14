import { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle, AlertCircle, Info, XCircle, Check, ChevronRight } from 'lucide-react';

const SEVERITY_CONFIG = {
  error: { icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Error' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Warning' },
  info: { icon: Info, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Info' },
};

const ANOMALY_LABELS = {
  ambiguous_date: 'Ambiguous Date',
  invalid_date: 'Invalid Date',
  duplicate_expense: 'Duplicate Expense',
  unknown_participant: 'Unknown Participant',
  membership_violation: 'Membership Violation',
  settlement_as_expense: 'Settlement as Expense',
  missing_fields: 'Missing Fields',
  rounding_issue: 'Rounding Issue',
  currency_foreign: 'Foreign Currency',
  missing_currency: 'Missing Currency',
  invalid_split: 'Invalid Split',
  zero_amount: 'Zero Amount',
  negative_amount: 'Negative Amount',
  conflicting_split_data: 'Conflicting Split Data',
  name_mismatch: 'Name Mismatch',
  format_error: 'Format Error',
  future_dated: 'Future Dated',
};

/**
 * Generic resolution modal driven by anomaly.resolutionOptions.
 */
export default function ResolutionModal({
  item,
  anomaly,
  groupMembers = [],
  onConfirm,
  onCancel,
  isSubmitting,
  quickResolve = null,
}) {
  const options = anomaly.resolutionOptions || [];
  const [selectedOption, setSelectedOption] = useState(anomaly.defaultResolution || (options[0]?.id ?? ''));
  const [inputValues, setInputValues] = useState({});

  // For percentage editing
  const [percentages, setPercentages] = useState({});

  const anomalyMeta = anomaly.meta || {};
  const anomalyLabel = ANOMALY_LABELS[anomaly.anomalyType || anomaly.type] || anomaly.anomalyType || anomaly.type;
  const severityCfg = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.info;
  const SeverityIcon = severityCfg.icon;

  // Init percentage state from meta
  useEffect(() => {
    if (anomalyMeta.isPercentageMismatch && anomalyMeta.members) {
      setPercentages({ ...anomalyMeta.members });
    }
  }, [anomalyMeta.isPercentageMismatch]);

  const percentageTotal = useMemo(() => {
    return Object.values(percentages).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }, [percentages]);

  const selectedOpt = options.find((o) => o.id === selectedOption);
  const needsInput = selectedOpt?.requiresInput;

  // Check if confirm is allowed
  const canConfirm = useMemo(() => {
    if (!selectedOption) return false;
    if (selectedOpt?.requiresInput) {
      // For percentage manual mode
      if (anomalyMeta.isPercentageMismatch && selectedOption === 'manual') {
        return Math.abs(percentageTotal - 100) < 0.01;
      }
      // For other inputs, check that value exists
      const val = inputValues[selectedOption];
      return val !== undefined && val !== '' && val !== null;
    }
    return true;
  }, [selectedOption, selectedOpt, inputValues, percentageTotal, anomalyMeta.isPercentageMismatch]);

  const handleConfirm = () => {
    if (!canConfirm || isSubmitting) return;

    const resolutionData = {};

    // Build resolution data based on anomaly type and selected option
    switch (anomaly.anomalyType || anomaly.type) {
      case 'ambiguous_date':
        if (selectedOption === 'interpretation_a' && anomalyMeta.interpretationDates) {
          resolutionData.confirmedDate = anomalyMeta.interpretationDates[0];
        } else if (selectedOption === 'interpretation_b' && anomalyMeta.interpretationDates) {
          resolutionData.confirmedDate = anomalyMeta.interpretationDates[1];
        } else if (selectedOption === 'custom') {
          resolutionData.confirmedDate = inputValues.custom;
        }
        break;

      case 'invalid_date':
        if (selectedOption === 'confirm' && anomalyMeta.confirmedDate) {
          resolutionData.confirmedDate = anomalyMeta.confirmedDate;
        } else if (selectedOption === 'custom') {
          resolutionData.confirmedDate = inputValues.custom;
        }
        break;

      case 'duplicate_expense':
        if (anomalyMeta.duplicateCandidateRowNumbers) {
          resolutionData.rowA = anomalyMeta.duplicateCandidateRowNumbers[0];
          resolutionData.rowB = anomalyMeta.duplicateCandidateRowNumbers[1];
          if (selectedOption === 'keep_first') {
            resolutionData.keepRowNumber = anomalyMeta.duplicateCandidateRowNumbers[0];
            resolutionData.discardRowNumber = anomalyMeta.duplicateCandidateRowNumbers[1];
          } else if (selectedOption === 'keep_second') {
            resolutionData.keepRowNumber = anomalyMeta.duplicateCandidateRowNumbers[1];
            resolutionData.discardRowNumber = anomalyMeta.duplicateCandidateRowNumbers[0];
          }
        }
        break;

      case 'unknown_participant':
        resolutionData.unknownName = anomalyMeta.unknownName || anomaly.rawValue || '';
        if (selectedOption === 'map') {
          resolutionData.selectedUserId = inputValues.map;
        } else if (selectedOption === 'create') {
          resolutionData.newMemberName = inputValues.create_name;
          resolutionData.newMemberEmail = inputValues.create_email;
        }
        break;

      case 'name_mismatch':
        resolutionData.unknownName = anomaly.rawValue || '';
        if (selectedOption === 'accept') {
          resolutionData.selectedUserId = anomalyMeta.matchedUserId;
        } else if (selectedOption === 'map') {
          resolutionData.selectedUserId = inputValues.map;
        }
        break;

      case 'membership_violation':
        resolutionData.violatingMember = anomalyMeta.violatingMember || anomaly.rawValue || '';
        break;

      case 'settlement_as_expense':
        // No extra data needed
        break;

      case 'missing_fields':
        if (selectedOption === 'assign') {
          resolutionData.selectedUserId = inputValues.assign;
        }
        break;

      case 'rounding_issue':
        if (selectedOption === 'accept_rounded') {
          resolutionData.suggested = anomalyMeta.suggested;
        } else if (selectedOption === 'custom') {
          resolutionData.correctedAmount = parseFloat(inputValues.custom);
        }
        break;

      case 'missing_currency':
        if (selectedOption === 'manual') {
          resolutionData.currency = inputValues.manual;
        }
        break;

      case 'currency_foreign':
        if (selectedOption === 'manual_rate') {
          resolutionData.exchangeRate = parseFloat(inputValues.manual_rate);
        }
        break;

      case 'invalid_split':
        if (selectedOption === 'manual') {
          resolutionData.adjustedPercentages = percentages;
        }
        break;

      case 'zero_amount':
        if (selectedOption === 'manual') {
          resolutionData.correctedAmount = parseFloat(inputValues.manual);
        }
        break;

      case 'negative_amount':
        resolutionData.absoluteValue = anomalyMeta.absoluteValue;
        break;

      case 'format_error':
        if (selectedOption === 'custom') {
          resolutionData.correctedAmount = parseFloat(inputValues.custom);
        } else if (selectedOption === 'accept') {
          resolutionData.cleanedValue = anomalyMeta.cleanedValue;
        }
        break;

      case 'conflicting_split_data':
        // No extra data needed
        break;
    }

    onConfirm(selectedOption, resolutionData);
  };

  // ─── Render special sections by anomaly type ────────────────────────

  const renderSpecialSection = () => {
    const type = anomaly.anomalyType || anomaly.type;

    // Duplicate: two-column comparison table
    if (type === 'duplicate_expense' && anomalyMeta.rowA && anomalyMeta.rowB) {
      const fields = ['rowNumber', 'description', 'paidBy', 'amount', 'date', 'notes'];
      return (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Row Comparison</p>
          <div className="overflow-x-auto">
            <table className="resolution-table w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 text-[var(--color-text-muted)]">Field</th>
                  <th className="text-left p-2">Row {anomalyMeta.rowA.rowNumber}</th>
                  <th className="text-left p-2">Row {anomalyMeta.rowB.rowNumber}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f}>
                    <td className="p-2 text-[var(--color-text-muted)] font-medium">{f}</td>
                    <td className="p-2">{anomalyMeta.rowA[f] ?? '—'}</td>
                    <td className="p-2">{anomalyMeta.rowB[f] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Membership violation: impact preview
    if (type === 'membership_violation' && anomalyMeta.currentMembers) {
      return (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Impact Preview</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <p className="text-xs font-medium text-red-400 mb-1">Current Split</p>
              {anomalyMeta.currentMembers.map((m) => (
                <p key={m} className="text-xs" style={{ color: m === anomalyMeta.violatingMember ? '#ef4444' : 'var(--color-text)' }}>
                  {m} {m === anomalyMeta.violatingMember && '⚠️'}
                </p>
              ))}
            </div>
            <div className="p-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <p className="text-xs font-medium text-green-400 mb-1">After Removal</p>
              {(anomalyMeta.activeMembers || []).map((m) => (
                <p key={m} className="text-xs">{m}</p>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Percentage mismatch: editable table
    if (type === 'invalid_split' && anomalyMeta.isPercentageMismatch && selectedOption === 'manual') {
      return (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Adjust Percentages</p>
          <div className="space-y-2">
            {Object.entries(percentages).map(([name, pct]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs w-24 truncate">{name}</span>
                <input
                  type="number"
                  step="0.01"
                  value={pct}
                  onChange={(e) => setPercentages((p) => ({ ...p, [name]: parseFloat(e.target.value) || 0 }))}
                  className="input text-xs py-1 px-2 w-20"
                />
                <span className="text-xs text-[var(--color-text-muted)]">%</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-medium">Total:</span>
              <span
                className="text-xs font-bold"
                style={{ color: Math.abs(percentageTotal - 100) < 0.01 ? '#10b981' : '#ef4444' }}
              >
                {percentageTotal.toFixed(2)}%
              </span>
              {Math.abs(percentageTotal - 100) > 0.01 && (
                <span className="text-xs text-red-400">Must equal 100%</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ─── Render input for the selected option ───────────────────────────

  const renderInput = () => {
    if (!selectedOpt?.requiresInput) return null;
    const type = anomaly.anomalyType || anomaly.type;

    // Date inputs
    if ((type === 'ambiguous_date' || type === 'invalid_date') && selectedOption === 'custom') {
      return (
        <div className="mt-2">
          <label className="input-label">Select Date</label>
          <input
            type="date"
            className="input text-sm"
            value={inputValues.custom || ''}
            onChange={(e) => setInputValues((v) => ({ ...v, custom: e.target.value }))}
          />
        </div>
      );
    }

    // Member select
    if ((type === 'unknown_participant' && selectedOption === 'map') ||
        (type === 'name_mismatch' && selectedOption === 'map') ||
        (type === 'missing_fields' && selectedOption === 'assign')) {
      const key = selectedOption;
      return (
        <div className="mt-2">
          <label className="input-label">Select Member</label>
          <select
            className="input text-sm"
            value={inputValues[key] || ''}
            onChange={(e) => setInputValues((v) => ({ ...v, [key]: e.target.value }))}
          >
            <option value="">— Choose member —</option>
            {groupMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      );
    }

    // Create new member
    if (type === 'unknown_participant' && selectedOption === 'create') {
      return (
        <div className="mt-2 space-y-2">
          <div>
            <label className="input-label">Name</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="Full name"
              value={inputValues.create_name || ''}
              onChange={(e) => setInputValues((v) => ({ ...v, create_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input text-sm"
              placeholder="email@example.com"
              value={inputValues.create_email || ''}
              onChange={(e) => setInputValues((v) => ({ ...v, create_email: e.target.value }))}
            />
          </div>
        </div>
      );
    }

    // Number inputs
    if ((type === 'rounding_issue' && selectedOption === 'custom') ||
        (type === 'zero_amount' && selectedOption === 'manual') ||
        (type === 'currency_foreign' && selectedOption === 'manual_rate') ||
        (type === 'format_error' && selectedOption === 'custom')) {
      const key = selectedOption === 'custom' ? 'custom' : selectedOption;
      const label = type === 'currency_foreign' ? 'Exchange Rate' : 'Amount';
      return (
        <div className="mt-2">
          <label className="input-label">{label}</label>
          <input
            type="number"
            step="0.01"
            className="input text-sm"
            value={inputValues[key] || ''}
            onChange={(e) => setInputValues((v) => ({ ...v, [key]: e.target.value }))}
          />
          {type === 'currency_foreign' && inputValues.manual_rate && item.parsedData?.amount && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {item.parsedData.currency} {Math.abs(item.parsedData.amount)} × {inputValues.manual_rate} ={' '}
              <span className="font-medium text-[var(--color-text)]">
                INR {(Math.abs(item.parsedData.amount) * parseFloat(inputValues.manual_rate || 0)).toFixed(2)}
              </span>
            </p>
          )}
        </div>
      );
    }

    // Currency select
    if (type === 'missing_currency' && selectedOption === 'manual') {
      const currencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED'];
      return (
        <div className="mt-2">
          <label className="input-label">Currency</label>
          <select
            className="input text-sm"
            value={inputValues.manual || ''}
            onChange={(e) => setInputValues((v) => ({ ...v, manual: e.target.value }))}
          >
            <option value="">— Choose currency —</option>
            {currencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      );
    }

    // Percentage manual: rendered in special section
    if (type === 'invalid_split' && selectedOption === 'manual') {
      return null;
    }

    return null;
  };

  // No resolution options (auto-resolved info-level anomalies)
  if (options.length === 0) {
    return (
      <div className="resolution-modal-overlay" onClick={onCancel}>
        <div className="resolution-modal animate-fadeIn" onClick={(e) => e.stopPropagation()}>
          <div className="resolution-modal-header">
            <div className="flex items-center gap-2">
              <SeverityIcon size={18} style={{ color: severityCfg.color }} />
              <h3 className="text-lg font-semibold">{anomalyLabel}</h3>
              <span className="text-xs text-[var(--color-text-muted)]">— Row {item.rowNumber}</span>
            </div>
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-[var(--color-bg-elevated)] transition">
              <X size={18} />
            </button>
          </div>
          <div className="resolution-modal-body">
            <div className="resolution-context">
              {item.rawData && (
                <div className="flex flex-col gap-1 text-xs mb-3 p-2 rounded-md" style={{ background: 'var(--color-bg-elevated)' }}>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Description:</span>
                    <span className="font-medium truncate text-right max-w-[250px]" title={item.rawData.description}>{item.rawData.description || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Amount:</span>
                    <span className="font-medium text-right">{item.rawData.amount || '—'} {item.rawData.currency || ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Paid By:</span>
                    <span className="font-medium text-right">{item.rawData.paid_by || '—'}</span>
                  </div>
                </div>
              )}
              {anomaly.field && (
                <div className="flex gap-4 text-xs mb-1">
                  <span className="text-[var(--color-text-muted)]">Field:</span>
                  <span className="font-mono">{anomaly.field}</span>
                </div>
              )}
              {anomaly.rawValue && (
                <div className="flex gap-4 text-xs mb-1">
                  <span className="text-[var(--color-text-muted)]">CSV value:</span>
                  <span className="font-mono">{String(anomaly.rawValue)}</span>
                </div>
              )}
              <div className="flex gap-4 text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-[var(--color-text-muted)]">Issue:</span>
                <span className="font-medium">{anomaly.details}</span>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mt-4">
              This anomaly is informational and was auto-resolved. No action required.
            </p>
          </div>
          <div className="resolution-modal-footer flex justify-between w-full">
            {quickResolve ? (
              <div className="flex items-center gap-2">
                <button onClick={quickResolve.onBack} disabled={quickResolve.currentIndex === 0 || isSubmitting} className="btn-secondary text-sm">Back</button>
                <span className="text-xs text-[var(--color-text-muted)] px-2">
                  {quickResolve.currentIndex + 1} of {quickResolve.total}
                </span>
              </div>
            ) : <div />}
            <div className="flex gap-2">
              {quickResolve && <button onClick={onCancel} className="btn-secondary text-sm" disabled={isSubmitting}>Close</button>}
              <button onClick={quickResolve ? quickResolve.onNext : onCancel} className="btn-primary text-sm">
                {quickResolve ? 'Next' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resolution-modal-overlay" onClick={onCancel}>
      <div className="resolution-modal animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="resolution-modal-header">
          <div className="flex items-center gap-2">
            <SeverityIcon size={18} style={{ color: severityCfg.color }} />
            <h3 className="text-lg font-semibold">{anomalyLabel}</h3>
            <span className="text-xs text-[var(--color-text-muted)]">— Row {item.rowNumber}</span>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-[var(--color-bg-elevated)] transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="resolution-modal-body">
          {/* Context block */}
          {/* Context block */}
          <div className="resolution-context">
            {item.rawData && (
              <div className="flex flex-col gap-1 text-xs mb-3 p-2 rounded-md" style={{ background: 'var(--color-bg-elevated)' }}>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Description:</span>
                  <span className="font-medium truncate text-right max-w-[250px]" title={item.rawData.description}>{item.rawData.description || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Amount:</span>
                  <span className="font-medium text-right">{item.rawData.amount || '—'} {item.rawData.currency || ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Paid By:</span>
                  <span className="font-medium text-right">{item.rawData.paid_by || '—'}</span>
                </div>
              </div>
            )}
            {anomaly.field && (
              <div className="flex gap-4 text-xs mb-1">
                <span className="text-[var(--color-text-muted)]">Field:</span>
                <span className="font-mono">{anomaly.field}</span>
              </div>
            )}
            {anomaly.rawValue && (
              <div className="flex gap-4 text-xs mb-1">
                <span className="text-[var(--color-text-muted)]">CSV value:</span>
                <span className="font-mono">{String(anomaly.rawValue)}</span>
              </div>
            )}
            <div className="flex gap-4 text-xs mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-[var(--color-text-muted)]">Issue:</span>
              <span className="font-medium">{anomaly.details}</span>
            </div>
          </div>

          {/* Special sections */}
          {renderSpecialSection()}

          {/* Options */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Choose Resolution</p>
            <div className="space-y-2">
              {options.map((opt) => (
                <label
                  key={opt.id}
                  className={`resolution-option ${selectedOption === opt.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={opt.id}
                    checked={selectedOption === opt.id}
                    onChange={() => setSelectedOption(opt.id)}
                    className="sr-only"
                  />
                  <div className="resolution-radio">
                    {selectedOption === opt.id && <div className="resolution-radio-dot" />}
                  </div>
                  <span className="text-sm">{opt.label}</span>
                  {opt.requiresInput && (
                    <ChevronRight size={14} className="ml-auto text-[var(--color-text-muted)]" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Conditional input */}
          {renderInput()}
        </div>

        {/* Footer */}
        <div className="resolution-modal-footer flex justify-between w-full">
          {quickResolve ? (
            <div className="flex items-center gap-2">
              <button onClick={quickResolve.onBack} disabled={quickResolve.currentIndex === 0 || isSubmitting} className="btn-secondary text-sm">Back</button>
              <span className="text-xs text-[var(--color-text-muted)] px-2">
                {quickResolve.currentIndex + 1} of {quickResolve.total}
              </span>
              <button onClick={quickResolve.onNext} disabled={isSubmitting} className="btn-secondary text-sm">Skip</button>
            </div>
          ) : (
            <button onClick={onCancel} className="btn-secondary text-sm" disabled={isSubmitting}>
              Cancel
            </button>
          )}

          <div className="flex gap-2">
            {quickResolve && <button onClick={onCancel} className="btn-secondary text-sm" disabled={isSubmitting}>Close</button>}
            <button
              onClick={handleConfirm}
              className="btn-primary text-sm"
              disabled={!canConfirm || isSubmitting}
            >
              <Check size={14} />
              {isSubmitting ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
