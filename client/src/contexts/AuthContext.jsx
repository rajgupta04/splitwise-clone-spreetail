import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  
  const [demoAccounts, setDemoAccounts] = useState(() => {
    const saved = localStorage.getItem('demoAccounts');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verify token on mount
    if (token) {
      authApi.getProfile()
        .then((res) => {
          setUser(res.data.data.user);
          localStorage.setItem('user', JSON.stringify(res.data.data.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user: userData, token: newToken } = res.data.data;
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', newToken);
    return userData;
  };

  const demoLogin = async () => {
    const res = await authApi.demoLogin();
    const { accounts } = res.data.data; // Now returns an array of { user, token }
    
    if (accounts && accounts.length > 0) {
      setDemoAccounts(accounts);
      localStorage.setItem('demoAccounts', JSON.stringify(accounts));

      const { user: userData, token: newToken } = accounts[0];
      setUser(userData);
      setToken(newToken);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', newToken);
      return userData;
    }
    throw new Error('No accounts returned from demo login');
  };

  const switchAccount = (userId) => {
    if (!demoAccounts) return;
    const account = demoAccounts.find((acc) => acc.user.id === userId);
    if (account) {
      setUser(account.user);
      setToken(account.token);
      localStorage.setItem('user', JSON.stringify(account.user));
      localStorage.setItem('token', account.token);
    }
  };

  const register = async (name, email, password) => {
    const res = await authApi.register({ name, email, password });
    const { user: userData, token: newToken } = res.data.data;
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', newToken);
    return userData;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setDemoAccounts(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('demoAccounts');
  };

  const updateCurrency = async (currency) => {
    try {
      const res = await authApi.updateCurrency(currency);
      const updatedUser = res.data.data.user;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, demoLogin, register, logout, updateCurrency, demoAccounts, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
