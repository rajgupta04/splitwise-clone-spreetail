import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, AlertCircle, Info, ChevronLeft, RefreshCw, Filter, Zap, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { importsApi, groupsApi, membershipsApi } from '../api/index';
import { formatCurrency, formatDate } from '../utils/helpers';
import ResolutionModal from '../components/ResolutionModal';
import ImportReportView from '../components/ImportReportView';

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
  resolved: { color: '#10b981', label: 'Resolved' },
  skipped: { color: '#94a3b8', label: 'Skipped' },
  imported: { color: '#10b981', label: 'Imported' },
};

const IMPORT_STATUS_CONFIG = {
  pending: { color: '#f59e0b', label: 'Pending' },
  resolved: { color: '#10b981', label: 'Resolved' },
  skipped: { color: '#94a3b8', label: 'Skipped' },
  rejected: { color: '#ef4444', label: 'Rejected' },
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
  const [executeReport, setExecuteReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupMembers, setGroupMembers] = useState([]);

  // Resolution modal state
  const [resolvingItem, setResolvingItem] = useState(null);
  const [resolvingAnomaly, setResolvingAnomaly] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Quick Resolve state
  const [quickResolveQueue, setQuickResolveQueue] = useState([]);
  const [quickResolveIndex, setQuickResolveIndex] = useState(0);

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

  const loadMembers = useCallback(async () => {
    try {
      const res = await membershipsApi.getActiveMembers(groupId);
      const members = (res.data.data?.members || res.data.data || []).map((m) => ({
        id: m.user?.id || m.userId || m.id,
        name: m.user?.name || m.name,
        email: m.user?.email || m.email,
      }));
      setGroupMembers(members);
    } catch { /* ignore */ }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
    loadImports();
    loadMembers();
  }, [loadGroup, loadImports, loadMembers]);

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

  // ─── Resolution Handlers ─────────────────────────────────────────

  const openResolution = (item, anomaly) => {
    setResolvingItem(item);
    setResolvingAnomaly(anomaly);
  };

  const closeResolution = () => {
    setResolvingItem(null);
    setResolvingAnomaly(null);
    setQuickResolveQueue([]);
    setQuickResolveIndex(0);
  };

  const startQuickResolve = () => {
    const queue = [];
    for (const item of items) {
      if (item.importStatus === 'pending' && item.anomalyFlags?.length > 0) {
        for (const anomaly of item.anomalyFlags) {
          const isResolved = item.resolutionType === 'compound' && item.resolutionData?.resolutions?.[anomaly.id];
          if (!isResolved) {
            queue.push({ item, anomaly });
          }
        }
      }
    }
    if (queue.length > 0) {
      setQuickResolveQueue(queue);
      setQuickResolveIndex(0);
      setResolvingItem(queue[0].item);
      setResolvingAnomaly(queue[0].anomaly);
    } else {
      toast.success("No pending items to resolve!");
    }
  };

  const handleQuickResolveNext = () => {
    if (quickResolveIndex + 1 < quickResolveQueue.length) {
      const nextIdx = quickResolveIndex + 1;
      setQuickResolveIndex(nextIdx);
      setResolvingItem(quickResolveQueue[nextIdx].item);
      setResolvingAnomaly(quickResolveQueue[nextIdx].anomaly);
    } else {
      closeResolution();
      toast.success("Quick resolve completed!");
    }
  };

  const handleQuickResolveBack = () => {
    if (quickResolveIndex > 0) {
      const prevIdx = quickResolveIndex - 1;
      setQuickResolveIndex(prevIdx);
      setResolvingItem(quickResolveQueue[prevIdx].item);
      setResolvingAnomaly(quickResolveQueue[prevIdx].anomaly);
    }
  };

  const handleResolve = async (resolutionType, resolutionData) => {
    if (!selectedImport || !resolvingItem || !resolvingAnomaly) return;
    setIsResolving(true);
    try {
      await importsApi.resolveItem(selectedImport.id, resolvingItem.id, {
        resolutionType,
        resolutionData,
        anomalyId: resolvingAnomaly.id,
      });
      toast.success('Anomaly resolved');
      await loadItems(selectedImport.id);

      if (quickResolveQueue.length > 0) {
        handleQuickResolveNext();
      } else {
        closeResolution();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve');
    } finally {
      setIsResolving(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedImport) return;
    setIsExecuting(true);
    try {
      const res = await importsApi.executeImport(selectedImport.id);
      const result = res.data.data.result;
      toast.success(
        `Import executed! ${result.createdExpenses} expenses, ${result.createdSettlements} settlements created.`
      );
      setExecuteReport(result.report);
      await loadImports();
      setActiveView('report');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
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

  // ─── Computed Values ─────────────────────────────────────────────

  const filteredItems = statusFilter === 'all'
    ? items
    : items.filter((i) => i.importStatus === statusFilter || i.status === statusFilter);

  const pendingCount = items.filter((i) => i.importStatus === 'pending').length;
  const resolvedCount = items.filter((i) => i.importStatus === 'resolved').length;
  const skippedCount = items.filter((i) => i.importStatus === 'skipped').length;
  const canExecute = selectedImport?.status === 'pending_review' && (resolvedCount > 0 || skippedCount > 0);

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
                The importer will detect anomalies and let you resolve each one.
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

              <div className="mt-8 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/Expenses_Export.csv"
                  download
                  className="text-sm font-medium hover:underline flex items-center gap-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <FileText size={14} /> Download Sample CSV
                </a>
                <span className="hidden sm:inline text-[var(--color-text-muted)]">•</span>
                <button
                  onClick={async () => {
                    try {
                      const res = await groupsApi.createMock();
                      toast.success('Mock Test Group created successfully!');
                      navigate(`/groups/${res.data.data.group.id}`);
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Failed to create mock group');
                    }
                  }}
                  className="text-sm font-medium flex items-center gap-1 transition hover:opacity-80"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <Zap size={14} /> Create Mock Test Group
                </button>
              </div>
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
                  {items.length} rows ·{' '}
                  <span style={{ color: '#f59e0b' }}>{pendingCount} pending</span> ·{' '}
                  <span style={{ color: '#10b981' }}>{resolvedCount} resolved</span> ·{' '}
                  <span style={{ color: '#94a3b8' }}>{skippedCount} skipped</span>
                </p>
              </div>
              <div className="flex gap-2 items-center">
                {pendingCount > 0 && (
                  <button
                    onClick={startQuickResolve}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                  >
                    <Zap size={14} className="inline mr-1" />
                    Quick Resolve
                  </button>
                )}
                <div className="relative group">
                  <button
                    onClick={handleExecute}
                    disabled={!canExecute || isExecuting}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: canExecute ? '#10b981' : '#334155', color: '#fff' }}
                  >
                    <CheckCircle size={14} className="inline mr-1" />
                    {isExecuting ? 'Executing...' : (pendingCount > 0 ? 'Execute Resolved' : 'Execute Import')}
                  </button>
                  {!canExecute && pendingCount > 0 && (
                    <div className="execute-tooltip">
                      Resolve or skip some anomalies to execute
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: `All (${items.length})` },
                { key: 'pending', label: `Pending (${pendingCount})` },
                { key: 'resolved', label: `Resolved (${resolvedCount})` },
                { key: 'skipped', label: `Skipped (${skippedCount})` },
                { key: 'error', label: `Errors (${items.filter((i) => i.status === 'error').length})` },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                  style={{
                    background: statusFilter === s.key ? 'var(--color-primary)' : 'var(--color-card)',
                    color: statusFilter === s.key ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  {s.label}
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
                    onResolve={openResolution}
                    importStatus={selectedImport.status}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                    No items match the selected filter.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Report View ─────────────────────────────────────── */}
        {activeView === 'report' && (
          <div className="space-y-6">
            {executeReport ? (
              <ImportReportView report={executeReport} importData={selectedImport} />
            ) : report ? (
              <>
                {/* Legacy Report Summary */}
                <div className="glass-card p-6">
                  <h2 className="text-xl font-semibold mb-4 gradient-text">Import Report</h2>
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
                {report.reports && report.reports.length > 0 ? (
                  <ImportReportView report={report.reports} importData={selectedImport} />
                ) : (
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
                            <div className="flex items-center gap-2">
                              {item.resolutionType && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                                  {item.resolutionType.replace(/_/g, ' ')}
                                </span>
                              )}
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
                )}
              </>
            ) : (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                {loading ? 'Loading report...' : 'Select a completed import to view its report.'}
              </div>
            )}
          </div>
        )}

        {/* ─── Resolution Modal ────────────────────────────────── */}
        {resolvingItem && resolvingAnomaly && (
          <ResolutionModal
            item={resolvingItem}
            anomaly={resolvingAnomaly}
            groupMembers={groupMembers}
            onConfirm={handleResolve}
            onCancel={closeResolution}
            isSubmitting={isResolving}
            quickResolve={quickResolveQueue.length > 0 ? {
              currentIndex: quickResolveIndex,
              total: quickResolveQueue.length,
              onNext: handleQuickResolveNext,
              onBack: handleQuickResolveBack
            } : null}
          />
        )}
      </div>
    </div>
  );
}

// ─── Import Item Card Component ──────────────────────────────────────────────

function ImportItemCard({ item, onResolve, importStatus }) {
  const [expanded, setExpanded] = useState(false);
  const hasAnomalies = item.anomalyFlags?.length > 0;
  const hasErrors = item.anomalyFlags?.some((a) => a.severity === 'error');
  const isResolved = item.importStatus === 'resolved' || item.importStatus === 'skipped';
  const isReviewable = importStatus === 'pending_review';

  const parsed = item.parsedData || {};
  const importStatusCfg = IMPORT_STATUS_CONFIG[item.importStatus] || IMPORT_STATUS_CONFIG.pending;

  const borderColor = item.importStatus === 'resolved' ? '#10b981'
    : item.importStatus === 'skipped' ? '#94a3b8'
      : hasErrors ? '#ef4444'
        : hasAnomalies ? '#f59e0b'
          : '#334155';

  // Find the primary anomaly to resolve (first unresolved one with resolution options)
  const resolvableAnomalies = (item.anomalyFlags || []).filter(
    (a) => {
      const isResolved = item.resolutionType === 'compound' && item.resolutionData?.resolutions?.[a.id];
      return !isResolved;
    }
  );

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
          {hasAnomalies && resolvableAnomalies.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{
              background: hasErrors ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
              color: hasErrors ? '#ef4444' : '#f59e0b',
            }}>
              {resolvableAnomalies.length} {resolvableAnomalies.length === 1 ? 'issue' : 'issues'}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
            background: `${importStatusCfg.color}20`,
            color: importStatusCfg.color,
          }}>
            {importStatusCfg.label}
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

          {/* Resolution info (if already resolved) */}
          {isResolved && item.resolutionType && item.resolutionType !== 'compound' && (
            <div className="mb-3 p-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <p className="text-xs font-semibold text-green-400 mb-1">
                <Shield size={12} className="inline mr-1" />
                Resolution Applied
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                <span className="font-medium">{item.resolutionType.replace(/_/g, ' ')}</span>
                {item.resolutionData && Object.keys(item.resolutionData).length > 0 && (
                  <span className="ml-1">— {JSON.stringify(item.resolutionData)}</span>
                )}
              </p>
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
                  const isThisAnomalyResolved = item.resolutionType === 'compound' && item.resolutionData?.resolutions?.[a.id];
                  const subRes = isThisAnomalyResolved ? item.resolutionData.resolutions[a.id] : null;

                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg text-xs"
                      style={{
                        background: isThisAnomalyResolved ? 'rgba(16,185,129,0.1)' : cfg.bg,
                        color: isThisAnomalyResolved ? '#10b981' : cfg.color
                      }}
                    >
                      {isThisAnomalyResolved ? <Check size={14} className="mt-0.5 flex-shrink-0" /> : <Icon size={14} className="mt-0.5 flex-shrink-0" />}
                      <div className="flex-1">
                        <span className="font-medium">[{a.anomalyType}]</span>{' '}
                        <span>{a.details}</span>
                        {isThisAnomalyResolved && (
                          <div className="mt-1 text-[10px] font-medium opacity-80">
                            Applied: {subRes.type.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                      {isReviewable && !isThisAnomalyResolved && !isResolved && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolve(item, a);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-medium transition hover:opacity-90 flex-shrink-0"
                          style={{ background: 'var(--color-primary)', color: '#fff' }}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resolve All button for items with multiple anomalies */}
          {isReviewable && !isResolved && hasAnomalies && resolvableAnomalies.length >= 1 && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(item, resolvableAnomalies[0]);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                <Zap size={14} /> Resolve Next Issue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
