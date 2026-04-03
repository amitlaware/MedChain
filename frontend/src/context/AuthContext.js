// frontend/src/context/AuthContext.js
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, setToken, clearToken, getToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      authAPI.me()
        .then(u => setUser(u))
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
