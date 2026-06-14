import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success('Welcome, Demo User!');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Demo Login failed');
    } finally {
      setDemoLoading(false);
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
            Less stress when sharing expenses with friends, family, and roommates.
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
              <LogIn size={24} className="text-[var(--color-primary)]" />
              Sign In
            </h2>

            {error && (
              <div className="flex items-center gap-2 mb-6 p-4 rounded-xl bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </div>
            )}

            <button 
              onClick={handleDemoLogin} 
              disabled={demoLoading || loading}
              className="w-full mb-6 flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 py-3 px-4 rounded-xl font-semibold transition-all shadow-sm border border-emerald-200"
            >
              {demoLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  Setting up Mock Data...
                </span>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>
                  Quick Demo Login (Auto-load CSV)
                </>
              )}
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-px bg-[var(--color-border)] flex-1"></div>
              <span className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">or sign in with email</span>
              <div className="h-px bg-[var(--color-border)] flex-1"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5" htmlFor="login-email">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    id="login-email"
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
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5" htmlFor="login-password">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    id="login-password"
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
                disabled={loading || demoLoading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
              Don't have an account?{' '}
              <Link to="/register" className="text-[var(--color-primary)] hover:underline font-semibold">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
