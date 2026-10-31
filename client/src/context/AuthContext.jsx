import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '../api/client.js';
import { fetchCurrentUser, loginRequest, logoutRequest, registerRequest } from '../api/auth.js';

export const AuthContext = createContext(null);

const ANONYMOUS = { user: null, status: 'anonymous' };

// Holds the current user. status: 'loading' (asking /api/auth/me), 'authenticated' or 'anonymous'. Not a security boundary.
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, status: 'loading' });

  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => setState(ANONYMOUS)); // any other 401 means the session is gone
    fetchCurrentUser()
      .then((user) => active && setState({ user, status: 'authenticated' }))
      .catch(() => active && setState(ANONYMOUS)); // 401 = logged out; other errors also end up logged out
    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  // login and register let the API error (ApiError with code and fields) reach the caller.
  const login = useCallback(async (email, password) => {
    const user = await loginRequest(email, password);
    setState({ user, status: 'authenticated' });
    return user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const user = await registerRequest(name, email, password);
    setState({ user, status: 'authenticated' });
    return user;
  }, []);

  // Local state is cleared even if the request fails; logout is idempotent on the server and the session expires anyway.
  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // ignored on purpose
    } finally {
      setState(ANONYMOUS);
    }
  }, []);

  const value = useMemo(() => ({ ...state, login, register, logout }), [state, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}