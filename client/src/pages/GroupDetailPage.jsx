import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { groupsApi, membershipsApi, expensesApi, balancesApi, settlementsApi } from '../api';
import { formatCurrency, formatDate, getInitials, getAvatarColor } from '../utils/helpers';
import {
  ArrowLeft, Users, Plus, DollarSign, ArrowRightLeft,
  UserPlus, UserMinus, Clock, Receipt, Trash2, History,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('expenses');
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);

  useEffect(() => { loadAll(); }, [groupId]);

  const loadAll = async () => {
    try {
      const [groupRes, membersRes, expensesRes, balancesRes, settlementsRes, historyRes] = await Promise.all([
        groupsApi.getById(groupId),
        membershipsApi.getActiveMembers(groupId),
        expensesApi.list(groupId, { page: 1, limit: 50 }),
        balancesApi.getGroupBalances(groupId).catch(() => null),
        settlementsApi.list(groupId),
        membershipsApi.getMembershipHistory(groupId),
      ]);
      setGroup(groupRes.data.data.group);
      setMembers(membersRes.data.data.members);
      setExpenses(expensesRes.data.data || []);
      setBalances(balancesRes?.data?.data?.balances || null);
      setSettlements(settlementsRes.data.data.settlements);
      setHistory(historyRes.data.data.history);
    } catch (err) {
      toast.error('Failed to load group');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (email) => {
    try {
      await membershipsApi.addMember(groupId, email);
      toast.success('Member added!');
      setShowAddMember(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member? Their debts will persist.')) return;
    try {
      await membershipsApi.removeMember(groupId, userId);
      toast.success('Member removed');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleAddExpense = async (data) => {
    try {
      await expensesApi.create(groupId, data);
      toast.success('Expense added!');
      setShowAddExpense(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await expensesApi.remove(expenseId);
      toast.success('Expense deleted');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  const handleSettlement = async (data) => {
    try {
      await settlementsApi.create(groupId, data);
      toast.success('Settlement recorded!');
      setShowSettlement(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record settlement');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--color-text-muted)]">Loading...</div>;
  }

  if (!group) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">Group not found</div>;
  }

  const tabs = [
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'balances', label: 'Balances', icon: DollarSign },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'settlements', label: 'Settlements', icon: ArrowRightLeft },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-[var(--color-text-muted)] hover:text-white transition">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{group.name}</h1>
            {group.description && <p className="text-xs text-[var(--color-text-muted)]">{group.description}</p>}
          </div>
          <span className="badge badge-info">{group.baseCurrency}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'expenses' && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Expenses</h2>
              <button onClick={() => setShowAddExpense(true)} className="btn-primary text-sm">
                <Plus size={16} /> Add Expense
              </button>
            </div>
            {expenses.length === 0 ? (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                No expenses yet. Add your first expense!
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((exp) => (
                  <div key={exp.id} className="glass-card p-4 flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: getAvatarColor(exp.paidBy?.id || '') }}
                    >
                      {getInitials(exp.paidBy?.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{exp.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Paid by {exp.paidBy?.name} · {formatDate(exp.expenseDate)} · {exp.splitType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(exp.normalizedAmount), group.baseCurrency)}</p>
                      {exp.originalCurrency !== group.baseCurrency && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatCurrency(Number(exp.originalAmount), exp.originalCurrency)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-400 transition p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'balances' && (
          <div className="animate-fadeIn">
            <h2 className="font-semibold mb-4">Group Balances</h2>
            {balances ? (
              <div className="space-y-6">
                {/* Member balances */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {balances.memberBalances?.map((mb) => (
                    <div key={mb.user.id} className="glass-card p-4 flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: getAvatarColor(mb.user.id) }}
                      >
                        {getInitials(mb.user.name)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{mb.user.name}</p>
                      </div>
                      <span className={`font-semibold ${mb.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {mb.balance >= 0 ? '+' : ''}{formatCurrency(mb.balance, balances.currency)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Simplified debts */}
                {balances.simplifiedDebts?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">
                      Suggested Settlements
                    </h3>
                    <div className="space-y-2">
                      {balances.simplifiedDebts.map((d, i) => (
                        <div key={i} className="glass-card p-4 flex items-center gap-3">
                          <span className="text-sm font-medium">{d.from.name}</span>
                          <ArrowRightLeft size={16} className="text-[var(--color-primary)]" />
                          <span className="text-sm font-medium">{d.to.name}</span>
                          <span className="ml-auto font-semibold text-[var(--color-accent)]">
                            {formatCurrency(d.amount, balances.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                No balance data available.
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Active Members ({members.length})</h2>
              <button onClick={() => setShowAddMember(true)} className="btn-primary text-sm">
                <UserPlus size={16} /> Add Member
              </button>
            </div>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="glass-card p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: getAvatarColor(m.user.id) }}
                  >
                    {getInitials(m.user.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{m.user.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{m.user.email}</p>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    <Clock size={12} className="inline mr-1" />
                    Joined {formatDate(m.joinedAt)}
                  </p>
                  {m.user.id !== user.id && (
                    <button
                      onClick={() => handleRemoveMember(m.user.id)}
                      className="text-[var(--color-text-muted)] hover:text-red-400 transition p-1"
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settlements' && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Settlements</h2>
              <button onClick={() => setShowSettlement(true)} className="btn-success text-sm">
                <ArrowRightLeft size={16} /> Record Settlement
              </button>
            </div>
            {settlements.length === 0 ? (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                No settlements recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {settlements.map((s) => (
                  <div key={s.id} className="glass-card p-4 flex items-center gap-3">
                    <span className="font-medium text-sm">{s.payer?.name}</span>
                    <span className="text-[var(--color-text-muted)]">paid</span>
                    <span className="font-medium text-sm">{s.payee?.name}</span>
                    <span className="ml-auto font-semibold text-emerald-400">
                      {formatCurrency(Number(s.normalizedAmount), group.baseCurrency)}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDate(s.settledAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-fadeIn">
            <h2 className="font-semibold mb-4">Membership History</h2>
            {history.length === 0 ? (
              <div className="glass-card p-8 text-center text-[var(--color-text-muted)]">
                No history available.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="glass-card p-4 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: getAvatarColor(h.user.id) }}
                    >
                      {getInitials(h.user.name)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{h.user.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{h.user.email}</p>
                    </div>
                    <span className={`badge ${h.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                      {h.status}
                    </span>
                    <div className="text-xs text-[var(--color-text-muted)] text-right">
                      <p>Joined: {formatDate(h.joinedAt)}</p>
                      {h.leftAt && <p>Left: {formatDate(h.leftAt)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAddMember && (
        <AddMemberModal onClose={() => setShowAddMember(false)} onSubmit={handleAddMember} />
      )}
      {showAddExpense && (
        <AddExpenseModal
          onClose={() => setShowAddExpense(false)}
          onSubmit={handleAddExpense}
          members={members}
          group={group}
          userId={user.id}
        />
      )}
      {showSettlement && (
        <SettlementModal
          onClose={() => setShowSettlement(false)}
          onSubmit={handleSettlement}
          members={members}
          group={group}
        />
      )}
    </div>
  );
}

/* ─── Add Member Modal ────────────────────────────────────────────────────── */
function AddMemberModal({ onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(email);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card p-8 w-full max-w-md animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Add Member</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Email address</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Add Expense Modal ───────────────────────────────────────────────────── */
function AddExpenseModal({ onClose, onSubmit, members, group, userId }) {
  const [form, setForm] = useState({
    paidById: userId,
    description: '',
    originalAmount: '',
    originalCurrency: group.baseCurrency,
    exchangeRate: 1,
    splitType: 'equal',
    expenseDate: new Date().toISOString().split('T')[0],
  });
  const [selectedMembers, setSelectedMembers] = useState(
    members.map((m) => ({ userId: m.user.id, amount: 0, percentage: 0, shares: 1 }))
  );
  const [loading, setLoading] = useState(false);

  const toggleMember = (userId) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((p) => p.userId === userId);
      if (exists) return prev.filter((p) => p.userId !== userId);
      return [...prev, { userId, amount: 0, percentage: 0, shares: 1 }];
    });
  };

  const updateParticipant = (userId, field, value) => {
    setSelectedMembers((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, [field]: Number(value) } : p))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const participants = selectedMembers.map((p) => {
      const base = { userId: p.userId };
      if (form.splitType === 'exact') base.amount = p.amount;
      if (form.splitType === 'percentage') base.percentage = p.percentage;
      if (form.splitType === 'shares') base.shares = p.shares;
      return base;
    });

    setLoading(true);
    await onSubmit({
      ...form,
      originalAmount: Number(form.originalAmount),
      exchangeRate: Number(form.exchangeRate),
      participants,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8" onClick={onClose}>
      <div className="glass-card p-8 w-full max-w-lg animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-6">Add Expense</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Description</label>
            <input type="text" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was it for?" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" className="input" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} placeholder="0.00" required />
            </div>
            <div>
              <label className="input-label">Currency</label>
              <input type="text" className="input" value={form.originalCurrency} onChange={(e) => setForm({ ...form, originalCurrency: e.target.value })} maxLength={3} />
            </div>
          </div>

          {form.originalCurrency !== group.baseCurrency && (
            <div>
              <label className="input-label">Exchange Rate (1 {form.originalCurrency} = ? {group.baseCurrency})</label>
              <input type="number" step="0.000001" className="input" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Paid by</label>
              <select className="input" value={form.paidById} onChange={(e) => setForm({ ...form, paidById: e.target.value })}>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Date</label>
              <input type="date" className="input" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="input-label">Split Type</label>
            <div className="grid grid-cols-4 gap-2">
              {['equal', 'exact', 'percentage', 'shares'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, splitType: type })}
                  className={`py-2 rounded-lg text-xs font-medium capitalize transition ${
                    form.splitType === type
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="input-label">Participants</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {members.map((m) => {
                const isSelected = selectedMembers.some((p) => p.userId === m.user.id);
                const participant = selectedMembers.find((p) => p.userId === m.user.id);
                return (
                  <div key={m.user.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMember(m.user.id)}
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="text-sm flex-1">{m.user.name}</span>
                    {isSelected && form.splitType === 'exact' && (
                      <input type="number" step="0.01" className="input w-24 text-sm py-1" placeholder="Amount" value={participant?.amount || ''} onChange={(e) => updateParticipant(m.user.id, 'amount', e.target.value)} />
                    )}
                    {isSelected && form.splitType === 'percentage' && (
                      <input type="number" step="0.01" className="input w-24 text-sm py-1" placeholder="%" value={participant?.percentage || ''} onChange={(e) => updateParticipant(m.user.id, 'percentage', e.target.value)} />
                    )}
                    {isSelected && form.splitType === 'shares' && (
                      <input type="number" min="1" className="input w-24 text-sm py-1" placeholder="Shares" value={participant?.shares || ''} onChange={(e) => updateParticipant(m.user.id, 'shares', e.target.value)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Settlement Modal ────────────────────────────────────────────────────── */
function SettlementModal({ onClose, onSubmit, members, group }) {
  const [form, setForm] = useState({
    payerId: '',
    payeeId: '',
    originalAmount: '',
    originalCurrency: group.baseCurrency,
    exchangeRate: 1,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({
      ...form,
      originalAmount: Number(form.originalAmount),
      exchangeRate: Number(form.exchangeRate),
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card p-8 w-full max-w-md animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-6">Record Settlement</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Who paid?</label>
            <select className="input" value={form.payerId} onChange={(e) => setForm({ ...form, payerId: e.target.value })} required>
              <option value="">Select payer</option>
              {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Paid to?</label>
            <select className="input" value={form.payeeId} onChange={(e) => setForm({ ...form, payeeId: e.target.value })} required>
              <option value="">Select payee</option>
              {members.filter((m) => m.user.id !== form.payerId).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Amount</label>
              <input type="number" step="0.01" className="input" value={form.originalAmount} onChange={(e) => setForm({ ...form, originalAmount: e.target.value })} required />
            </div>
            <div>
              <label className="input-label">Currency</label>
              <input type="text" className="input" value={form.originalCurrency} onChange={(e) => setForm({ ...form, originalCurrency: e.target.value })} maxLength={3} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-success flex-1 justify-center" disabled={loading}>
              {loading ? 'Recording...' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
