import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Mail, Lock, User, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Graphic/Branding */}
      <div className="hidden lg:flex w-1/2 bg-[var(--color-primary)] flex-col justify-center items-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}></div>
        <div className="relative z-10 text-center">
          <div className="bg-white/20 p-6 rounded-3xl inline-block mb-8 backdrop-blur-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2"></rect>
              <circle cx="12" cy="12" r="2"></circle>
              <path d="M6 12h.01M18 12h.01"></path>
            </svg>
          </div>
          <h1 className="text-5xl font-bold mb-4">Splitwise</h1>
          <p className="text-xl text-green-50/90 max-w-md mx-auto leading-relaxed">
            The easiest way to share expenses across trips, apartments, and friend groups.
          </p>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[var(--color-bg)]">
        <div className="w-full max-w-md animate-fadeIn">
          
          <div className="text-center mb-10 lg:hidden">
            <h1 className="text-4xl font-bold gradient-text mb-2">Splitwise</h1>
            <p className="text-[var(--color-text-muted)]">Share expenses, not headaches</p>
          </div>

          <div className="bg-[var(--color-bg-elevated)] p-8 rounded-2xl shadow-xl border border-[var(--color-border)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
            
            <h2 className="text-2xl font-bold mb-6 text-[var(--color-text)] flex items-center gap-2">
              <UserPlus size={24} className="text-[var(--color-primary)]" />
              Create Account
            </h2>

            {error && (
              <div className="flex items-center gap-2 mb-6 p-4 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5" htmlFor="register-name">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    id="register-name"
                    type="text"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl py-3 pl-10 pr-4 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5" htmlFor="register-email">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    id="register-email"
                    type="email"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl py-3 pl-10 pr-4 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5" htmlFor="register-password">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    id="register-password"
                    type="password"
                    className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl py-3 pl-10 pr-4 text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full flex items-center justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-sm" 
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
              Already have an account?{' '}
              <Link to="/login" className="text-[var(--color-primary)] hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
