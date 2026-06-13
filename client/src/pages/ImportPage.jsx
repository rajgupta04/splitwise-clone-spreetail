import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, AlertCircle, Info, ChevronLeft, RefreshCw, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { importsApi, groupsApi } from '../api/index';
import { formatCurrency, formatDate } from '../utils/helpers';

const SEVERITY_CONFIG = {
  error: { icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Error' },
  warning: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Warning' },
  info: { icon: Info, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Info' },
};

const STATUS_CONFIG = {
  clean: { color: '#10b981', label: 'Clean' },
  flagged: { color: '#f59e0b', label: 'Flagged' },
  error: { color: '#ef4444', label: 'Error' },
  approved: { color: '#10b981', label: 'Approved' },
  rejected: { color: '#ef4444', label: 'Rejected' },
  pending: { color: '#6b7280', label: 'Pending' },
};

export default function ImportPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [activeView, setActiveView] = useState('upload'); // upload | review | report
  const [uploading, setUploading] = useState(false);
  const [imports, setImports] = useState([]);
  const [selectedImport, setSelectedImport] = useState(null);
  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [decidingItem, setDecidingItem] = useState(null);

  const loadGroup = useCallback(async () => {
    try {
      const res = await groupsApi.getById(groupId);
      setGroup(res.data.data.group);
    } catch { /* ignore */ }
  }, [groupId]);

  const loadImports = useCallback(async () => {
    try {
      const res = await importsApi.list(groupId);
      setImports(res.data.data.imports || []);
    } catch { /* ignore */ }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
    loadImports();
  }, [loadGroup, loadImports]);

  // ─── Upload Handler ──────────────────────────────────────────────

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await importsApi.upload(groupId, file);
      const imp = res.data.data.import;
      toast.success(`CSV uploaded! ${imp.summary?.total || 0} rows parsed.`);
      await loadImports();
      setSelectedImport(imp);
      await loadItems(imp.id);
      setActiveView('review');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ─── Review Handlers ─────────────────────────────────────────────

  const loadItems = async (importId) => {
    setLoading(true);
    try {
      const res = await importsApi.getItems(importId);
      setItems(res.data.data.items || []);
    } catch (err) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const selectImport = async (imp) => {
    setSelectedImport(imp);
    await loadItems(imp.id);
    setActiveView('review');
  };

  const handleDecide = async (itemId, decision) => {
    if (!selectedImport) return;
    setDecidingItem(itemId);
    try {
      await importsApi.decideItem(selectedImport.id, itemId, { decision });
      toast.success(`Item ${decision === 'approve' ? 'approved' : 'rejected'}`);
      await loadItems(selectedImport.id);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${decision}`);
    } finally {
      setDecidingItem(null);
    }
  };

  const handleFinalize = async () => {
    if (!selectedImport) return;
    try {
      const res = await importsApi.finalize(selectedImport.id);
      const result = res.data.data.result;
      toast.success(
        `Import finalized! ${result.createdExpenses} expenses, ${result.createdSettlements} settlements created.`
      );
      await loadImports();
      await loadReport(selectedImport.id);
      setActiveView('report');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Finalization failed');
    }
  };

  // ─── Report Handler ──────────────────────────────────────────────

  const loadReport = async (importId) => {
    setLoading(true);
    try {
      const res = await importsApi.getReport(importId);
      setReport(res.data.data.report);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtered Items ──────────────────────────────────────────────

  const filteredItems = statusFilter === 'all'
    ? items
    : items.filter((i) => i.status === statusFilter);

  const pendingReview = items.filter(
    (i) => i.status !== 'approved' && i.status !== 'rejected' && i.status !== 'error'
  );
  const canFinalize = selectedImport?.status === 'pending_review' && pendingReview.length === 0;

  // ─── RENDER ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/groups/${groupId}`)}
            className="p-2 rounded-lg hover:bg-[var(--color-card)] transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold gradient-text">CSV Import</h1>
            {group && <p className="text-sm text-[var(--color-text-muted)]">{group.name}</p>}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {['upload', 'review', 'report'].map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{
                background: activeView === v ? 'var(--color-primary)' : 'var(--color-card)',
                color: activeView === v ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {v === 'upload' && <Upload size={14} className="inline mr-1.5" />}
              {v === 'review' && <FileText size={14} className="inline mr-1.5" />}
              {v === 'report' && <CheckCircle size={14} className="inline mr-1.5" />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* ─── Upload View ─────────────────────────────────────── */}
        {activeView === 'upload' && (
          <div className="space-y-6">
            {/* Upload Card */}
            <div className="glass-card p-8 text-center">
              <Upload size={48} className="mx-auto mb-4 text-[var(--color-primary)]" />
              <h2 className="text-xl font-semibold mb-2">Upload Expense CSV</h2>
              <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
                Upload <code>expenses_export.csv</code> to import historical data.
                The importer will detect anomalies and let you review each row.
              </p>
              <label
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium cursor-pointer transition hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                {uploading ? (
                  <><RefreshCw size={18} className="animate-spin" /> Parsing...</>
                ) : (
                  <><Upload size={18} /> Select CSV File</>
                )}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Import History */}
            {imports.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Import History</h3>
                <div className="space-y-2">
                  {imports.map((imp) => (
                    <div
                      key={imp.id}
                      className="glass-card p-4 flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] transition"
                      onClick={() => {
                        if (imp.status === 'pending_review') selectImport(imp);
                        else { setSelectedImport(imp); loadReport(imp.id); setActiveView('report'); }
                      }}
                    >
                      <div>
                        <p className="font-medium">{imp.fileName}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatDate(imp.createdAt)} · {imp.totalRows} rows · by {imp.uploadedBy?.name}
                        </p>
                      </div>
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          background: imp.status === 'completed' ? 'rgba(16,185,129,0.15)' :
                            imp.status === 'pending_review' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: imp.status === 'completed' ? '#10b981' :
                            imp.status === 'pending_review' ? '#f59e0b' : '#ef4444',
                        }}
                      >
                        {imp.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Review View ─────────────────────────────────────── */}
        {activeView === 'review' && selectedImport && (
          <div className="space-y-4">
            {/* Summary Bar */}
            <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{selectedImport.fileName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {items.length} rows · {items.filter((i) => i.anomalyFlags?.length > 0).length} flagged ·
                  {items.filter((i) => i.status === 'approved').length} approved ·
                  {items.filter((i) => i.status === 'rejected').length} rejected
                </p>
              </div>
              <div className="flex gap-2">
                {canFinalize && (
                  <button
                    onClick={handleFinalize}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
                    style={{ background: '#10b981', color: '#fff' }}
                  >
                    <CheckCircle size={14} className="inline mr-1" /> Finalize Import
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {['all', 'clean', 'flagged', 'error', 'approved', 'rejected'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{
                    background: statusFilter === s ? 'var(--color-primary)' : 'var(--color-card)',
                    color: statusFilter === s ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  {s === 'all' ? `All (${items.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${items.filter((i) => i.status === s).length})`}
                </button>
              ))}
            </div>

            {/* Items List */}
            {loading ? (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">Loading items...</div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <ImportItemCard
                    key={item.id}
                    item={item}
                    onDecide={handleDecide}
                    decidingItem={decidingItem}
                    importStatus={selectedImport.status}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Report View ─────────────────────────────────────── */}
        {activeView === 'report' && (
          <div className="space-y-6">
            {report ? (
              <>
                {/* Report Summary */}
                <div className="glass-card p-6">
                  <h2 className="text-xl font-semibold mb-4">Import Report</h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Total Rows', val: report.summary.totalRows, color: '#94a3b8' },
                      { label: 'Clean', val: report.summary.validRows, color: '#10b981' },
                      { label: 'Flagged', val: report.summary.flaggedRows, color: '#f59e0b' },
                      { label: 'Approved', val: report.summary.approvedRows, color: '#10b981' },
                      { label: 'Rejected', val: report.summary.rejectedRows, color: '#ef4444' },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-Row Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Row Details</h3>
                  <div className="space-y-2">
                    {report.items.map((item) => (
                      <div key={item.rowNumber} className="glass-card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[var(--color-text-muted)]">Row {item.rowNumber}</span>
                            <span className="font-medium">{item.rawData?.description || '—'}</span>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: STATUS_CONFIG[item.status]?.color ? `${STATUS_CONFIG[item.status].color}20` : 'transparent',
                              color: STATUS_CONFIG[item.status]?.color || '#6b7280',
                            }}
                          >
                            {STATUS_CONFIG[item.status]?.label || item.status}
                          </span>
                        </div>
                        {item.anomalies?.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {item.anomalies.map((a, i) => {
                              const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.info;
                              return (
                                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: cfg.color }}>
                                  <cfg.icon size={12} className="mt-0.5 flex-shrink-0" />
                                  <span>{a.details}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                {loading ? 'Loading report...' : 'Select a completed import to view its report.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Import Item Card Component ──────────────────────────────────────────────

function ImportItemCard({ item, onDecide, decidingItem, importStatus }) {
  const [expanded, setExpanded] = useState(false);
  const hasAnomalies = item.anomalyFlags?.length > 0;
  const hasErrors = item.anomalyFlags?.some((a) => a.severity === 'error');
  const isDecided = item.status === 'approved' || item.status === 'rejected';
  const isReviewable = importStatus === 'pending_review';
  const isDeciding = decidingItem === item.id;

  const parsed = item.parsedData || {};
  const borderColor = item.status === 'approved' ? '#10b981'
    : item.status === 'rejected' ? '#ef4444'
      : hasErrors ? '#ef4444'
        : hasAnomalies ? '#f59e0b'
          : '#334155';

  return (
    <div
      className="glass-card p-4 transition cursor-pointer"
      style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Row Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono text-[var(--color-text-muted)] w-10 flex-shrink-0">
            R{item.rowNumber}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{parsed.description || item.rawData?.description || '—'}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {parsed.paidBy || item.rawData?.paid_by || '?'} ·{' '}
              {parsed.amount != null ? `${parsed.currency || ''} ${parsed.amount}` : '?'} ·{' '}
              {parsed.date || item.rawData?.date || '?'} ·{' '}
              {parsed.splitType || item.rawData?.split_type || '?'}
              {parsed.isSettlement && <span className="ml-1 text-yellow-400">⚡ Settlement</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasAnomalies && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{
              background: hasErrors ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: hasErrors ? '#ef4444' : '#f59e0b',
            }}>
              {item.anomalyFlags.length} {item.anomalyFlags.length === 1 ? 'issue' : 'issues'}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
            background: STATUS_CONFIG[item.status]?.color ? `${STATUS_CONFIG[item.status].color}20` : 'transparent',
            color: STATUS_CONFIG[item.status]?.color || '#6b7280',
          }}>
            {STATUS_CONFIG[item.status]?.label || item.status}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#334155]" onClick={(e) => e.stopPropagation()}>
          {/* Raw Data */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Raw CSV Data</p>
            <div className="text-xs p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <code>
                {Object.entries(item.rawData || {})
                  .filter(([k]) => !k.startsWith('_'))
                  .map(([k, v]) => `${k}: ${v || '(empty)'}`)
                  .join(' | ')}
              </code>
            </div>
          </div>

          {/* Notes */}
          {item.rawData?.notes && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Note</p>
              <p className="text-xs italic text-[var(--color-text-muted)]">"{item.rawData.notes}"</p>
            </div>
          )}

          {/* Anomalies */}
          {hasAnomalies && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Detected Anomalies</p>
              <div className="space-y-1.5">
                {item.anomalyFlags.map((a, i) => {
                  const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.info;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg text-xs"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <Icon size={14} className="mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">[{a.anomalyType}]</span>{' '}
                        <span>{a.details}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isReviewable && !isDecided && (
            <div className="flex gap-2 pt-2">
              {!hasErrors && (
                <button
                  onClick={() => onDecide(item.id, 'approve')}
                  disabled={isDeciding}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90"
                  style={{ background: '#10b981', color: '#fff' }}
                >
                  <CheckCircle size={14} /> Approve
                </button>
              )}
              <button
                onClick={() => onDecide(item.id, 'reject')}
                disabled={isDeciding}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
