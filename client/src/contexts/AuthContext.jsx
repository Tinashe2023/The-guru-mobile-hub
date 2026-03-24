import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, fetchCsrfToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await fetchCsrfToken();
      await checkAuth();
    };
    init();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await authAPI.getMe();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await authAPI.login({ email, password });
    await fetchCsrfToken();
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await authAPI.register(userData);
    await fetchCsrfToken();
    setUser(data.user);
    return data;
  };

  const loginWithPasskey = async (data) => {
    await fetchCsrfToken();
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // ok
    }
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithPasskey, register, logout, updateUser, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};
