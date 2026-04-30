import { createContext, useContext, useState, useCallback, useEffect } from 'react';
const AuthContext = createContext(null);
const TOKEN_KEY = 'streamtube_token';

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => getStoredToken());

  const isAuthenticated = !!user;

  // On mount: check token validity
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  // Register
  const register = useCallback(async (nickname, email, password) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, password }),
      });
      const data = await res.json();
      if (!data.success) return { success: false, error: data.error };

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      window.location.href = '/';
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Login
  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) return { success: false, error: data.error };

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      window.location.href = '/';
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success && data.user) setUser(data.user);
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [token]);

  // Change password
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      loading,
      token,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
