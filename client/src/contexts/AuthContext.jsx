import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
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
    const { user: userData, token: newToken } = res.data.data;
    setUser(userData);
    setToken(newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', newToken);
    return userData;
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
    localStorage.removeItem('user');
    localStorage.removeItem('token');
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
    <AuthContext.Provider value={{ user, token, loading, login, demoLogin, register, logout, updateCurrency }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
