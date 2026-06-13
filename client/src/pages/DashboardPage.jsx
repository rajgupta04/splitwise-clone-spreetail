import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { groupsApi, balancesApi } from '../api';
import { formatCurrency, getInitials, getAvatarColor } from '../utils/helpers';
import { CURRENCIES } from '../utils/constants';
import {
  Plus, Users, TrendingUp, TrendingDown, Wallet,
  LogOut, ChevronRight, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [balanceSummary, setBalanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsRes, balancesRes] = await Promise.all([
        groupsApi.list(),
        balancesApi.getUserSummary(),
      ]);
      setGroups(groupsRes.data.data.groups);
      setBalanceSummary(balancesRes.data.data.summary);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (data) => {
    try {
      await groupsApi.create(data);
      toast.success('Group created!');
      setShowCreateModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold gradient-text">Splitwise</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-muted)]">{user?.name}</span>
            <button onClick={logout} className="btn-secondary text-xs py-2 px-3">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Balance Summary */}
        {balanceSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fadeIn">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-400" />
                </div>
                <span className="text-sm text-[var(--color-text-muted)]">You are owed</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(balanceSummary.totalOwed)}
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <TrendingDown size={20} className="text-red-400" />
                </div>
                <span className="text-sm text-[var(--color-text-muted)]">You owe</span>
              </div>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(balanceSummary.totalOwing)}
              </p>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center">
                  <Wallet size={20} className="text-[var(--color-primary-light)]" />
                </div>
                <span className="text-sm text-[var(--color-text-muted)]">Net balance</span>
              </div>
              <p className={`text-2xl font-bold ${balanceSummary.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(balanceSummary.netBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Groups */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users size={20} className="text-[var(--color-primary)]" />
            Your Groups
          </h2>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm">
            <Plus size={16} /> New Group
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Users size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
            <p className="text-[var(--color-text-muted)] mb-4">No groups yet. Create your first group!</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus size={16} /> Create Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="glass-card p-6 block animate-fadeIn"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">{group.name}</h3>
                  <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
                </div>
                {group.description && (
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">{group.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {group.memberships?.slice(0, 5).map((m) => (
                      <div
                        key={m.user.id}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-[var(--color-bg-card)]"
                        style={{ backgroundColor: getAvatarColor(m.user.id) }}
                        title={m.user.name}
                      >
                        {getInitials(m.user.name)}
                      </div>
                    ))}
                    {group.memberships?.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-xs text-[var(--color-text-muted)] border-2 border-[var(--color-bg-card)]">
                        +{group.memberships.length - 5}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                    <DollarSign size={14} />
                    {group._count?.expenses || 0} expenses
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateGroup}
        />
      )}
    </div>
  );
}

function CreateGroupModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', description: '', baseCurrency: 'USD' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card p-8 w-full max-w-md animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-6">Create New Group</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label" htmlFor="group-name">Group Name</label>
            <input
              id="group-name"
              type="text"
              className="input"
              placeholder="e.g., Roommates, Trip to Europe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="input-label" htmlFor="group-desc">Description (optional)</label>
            <input
              id="group-desc"
              type="text"
              className="input"
              placeholder="What's this group for?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label" htmlFor="group-currency">Base Currency</label>
            <select
              id="group-currency"
              className="input"
              value={form.baseCurrency}
              onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
