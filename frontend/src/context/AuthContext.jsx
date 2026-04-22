import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, TOKEN_KEY, formatApiError } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = unauthenticated, object = user
  const [user, setUser] = useState(null);

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (_e) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  };

  const register = async (name, company_name, email, password) => {
    try {
      const { data } = await api.post("/auth/register", { name, company_name, email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e) };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
