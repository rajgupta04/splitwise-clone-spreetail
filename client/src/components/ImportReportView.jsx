import { Download } from 'lucide-react';

const STATUS_COLORS = {
  IMPORTED: '#10b981',
  SKIPPED: '#f59e0b',
  FAILED: '#ef4444',
};

/**
 * Import report view shown after POST /execute succeeds.
 * Displays a table of all rows with their resolutions and allows CSV export.
 */
export default function ImportReportView({ report, importData }) {
  const rows = report || [];

  // Group rows by Detected Issue and Action Taken
  const groupedMap = new Map();
  rows.forEach((r) => {
    const issue = r.detectedIssue || 'None';
    const decision = r.userDecision || 'None';
    const key = `${issue}|${decision}`;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, { ...r, allRowNumbers: [r.rowNumber] });
    } else {
      groupedMap.get(key).allRowNumbers.push(r.rowNumber);
    }
  });
  const groupedRows = Array.from(groupedMap.values()).sort((a, b) => a.allRowNumbers[0] - b.allRowNumbers[0]);

  const handleExportCSV = () => {
    const headers = ['Row', 'Original Value', 'Detected Issue', 'Action Taken', 'Final Value'];
    const csvRows = groupedRows.map((r) => {
      const rawData = r.originalValue || {};
      const originalVal = rawData.amount ? `${rawData.currency || ''} ${rawData.amount}` : '—';
      const originalValDisplay = r.allRowNumbers.length > 1 ? `${originalVal} (+${r.allRowNumbers.length - 1} more)` : originalVal;
      
      const anomaly = r.detectedIssue || '—';
      const decisionParts = (r.userDecision || '').split(':');
      const resType = decisionParts[0]?.toLowerCase().trim();
      let resData = {};
      try {
        if (decisionParts.length > 1) {
          resData = JSON.parse(decisionParts.slice(1).join(':').trim());
        }
      } catch (e) {}

      let actionTaken = resType;
      if (resType === 'interpretation_a') actionTaken = 'Used 1st Interpretation (DD/MM)';
      else if (resType === 'interpretation_b') actionTaken = 'Used 2nd Interpretation (MM/DD)';
      else if (resType === 'accept_rounded') actionTaken = 'Accepted Rounded Amount';
      else if (resType === 'accept') actionTaken = 'Accepted As Is';
      else if (resType === 'reject') actionTaken = 'Rejected (Skipped)';
      else if (resType === 'assign') {
        actionTaken = resData.participantName ? `Assigned to ${resData.participantName}` : 'Assigned to Participant';
      }
      else if (resType === 'custom') {
        if (resData.customPayer) actionTaken = `Assigned Payer: ${resData.customPayer}`;
        else if (resData.useAs) actionTaken = `Used custom value: ${resData.useAs}`;
        else actionTaken = 'Used Custom Value';
      }
      else if (resType === 'auto-resolved (clean)') actionTaken = 'Auto-Resolved (Clean)';
      else if (resType) {
        actionTaken = resType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      } else {
        actionTaken = '—';
      }

      const finalVal = r.finalValue?.status || '—';

      return [r.allRowNumbers.join(', '), originalValDisplay, anomaly, actionTaken, finalVal]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute stats
  const imported = rows.filter((r) => r.finalValue?.status === 'IMPORTED');
  const skipped = rows.filter((r) => r.finalValue?.status === 'SKIPPED');
  const failed = rows.filter((r) => r.finalValue?.status === 'FAILED');

  // Deduplicate by rowNumber for the summary cards
  const uniqueRows = [...new Map(rows.map((r) => [r.rowNumber, r])).values()];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary Cards */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold gradient-text">Import Report</h2>
          <button onClick={handleExportCSV} className="btn-secondary text-sm">
            <Download size={14} />
            Export as CSV
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Rows', val: uniqueRows.length, color: '#94a3b8' },
            { label: 'Imported', val: new Set(imported.map((r) => r.rowNumber)).size, color: '#10b981' },
            { label: 'Skipped', val: new Set(skipped.map((r) => r.rowNumber)).size, color: '#f59e0b' },
            { label: 'Failed', val: new Set(failed.map((r) => r.rowNumber)).size, color: '#ef4444' },
          ].map((s) => (
            <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: `${s.color}10` }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Report Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left p-3 text-xs font-semibold text-[var(--color-text-muted)]">Row</th>
                <th className="text-left p-3 text-xs font-semibold text-[var(--color-text-muted)]">Original Value</th>
                <th className="text-left p-3 text-xs font-semibold text-[var(--color-text-muted)]">Detected Issue</th>
                <th className="text-left p-3 text-xs font-semibold text-[var(--color-text-muted)]">Action Taken</th>
                <th className="text-left p-3 text-xs font-semibold text-[var(--color-text-muted)]">Final Value</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((r, idx) => {
                const rawData = r.originalValue || {};
                const originalVal = rawData.amount ? `${rawData.currency || ''} ${rawData.amount}` : '—';
                const originalValDisplay = r.allRowNumbers.length > 1 ? `${originalVal} (+${r.allRowNumbers.length - 1} more)` : originalVal;

                const statusColor = STATUS_COLORS[r.finalValue?.status] || '#94a3b8';
                const importedAs = r.finalValue?.type
                  ? `${r.finalValue.type}`
                  : r.finalValue?.reason || r.finalValue?.status || '—';

                const decisionParts = (r.userDecision || '').split(':');
                const resType = decisionParts[0]?.toLowerCase().trim();
                let resData = {};
                try {
                  if (decisionParts.length > 1) {
                    resData = JSON.parse(decisionParts.slice(1).join(':').trim());
                  }
                } catch (e) {}

                let actionTaken = resType;
                if (resType === 'interpretation_a') actionTaken = 'Used 1st Interpretation (DD/MM)';
                else if (resType === 'interpretation_b') actionTaken = 'Used 2nd Interpretation (MM/DD)';
                else if (resType === 'accept_rounded') actionTaken = 'Accepted Rounded Amount';
                else if (resType === 'accept') actionTaken = 'Accepted As Is';
                else if (resType === 'reject') actionTaken = 'Rejected (Skipped)';
                else if (resType === 'assign') {
                  actionTaken = resData.participantName 
                    ? `Assigned to ${resData.participantName}` 
                    : 'Assigned to Participant';
                }
                else if (resType === 'custom') {
                  if (resData.customPayer) actionTaken = `Assigned Payer: ${resData.customPayer}`;
                  else if (resData.useAs) actionTaken = `Used custom value: ${resData.useAs}`;
                  else actionTaken = 'Used Custom Value';
                }
                else if (resType === 'auto-resolved (clean)') actionTaken = 'Auto-Resolved (Clean)';
                else if (resType) {
                  actionTaken = resType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                } else {
                  actionTaken = '—';
                }

                return (
                  <tr
                    key={idx}
                    className="border-b border-[#1e293b] hover:bg-[rgba(255,255,255,0.02)] transition"
                  >
                    <td className="p-3 font-mono text-xs text-[var(--color-text-muted)]">
                      {r.allRowNumbers.length > 1 ? `Rows ${r.allRowNumbers.join(', ')}` : `R${r.allRowNumbers[0]}`}
                    </td>
                    <td className="p-3 text-xs font-mono">
                      {originalValDisplay}
                    </td>
                    <td className="p-3 text-xs max-w-48">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                        {(r.detectedIssue || 'None').split(' — ')[0]}
                      </span>
                    </td>
                    <td className="p-3 text-xs capitalize">{actionTaken}</td>
                    <td className="p-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${statusColor}20`, color: statusColor }}
                      >
                        {r.finalValue?.status || '—'}
                      </span>
                      {r.finalValue?.status === 'SKIPPED' && r.finalValue.reason && (
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
                          ({r.finalValue.reason.replace(/_/g, ' ')})
                        </span>
                      )}
                      {importedAs !== r.finalValue?.status && importedAs !== '—' && (
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
                          ({importedAs})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            No report data available.
          </div>
        )}
      </div>
    </div>
  );
}
