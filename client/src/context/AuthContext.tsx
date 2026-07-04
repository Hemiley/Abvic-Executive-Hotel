import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Shift } from "../lib/api";

type AuthUser = { id: string; username: string; fullName: string; role: string; avatarUrl?: string | null } | null;

type LoginResult = { id: string; username: string; fullName: string; role: string; avatarUrl: string | null; shift: Shift | null };

type AuthContextValue = {
  user: AuthUser;
  shift: Shift | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshShift: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((res) => {
        setUser(res);
        setShift(res.shift);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const result = await api.login(username, password);
    setUser(result);
    setShift(result.shift);
    return result;
  }

  async function logout() {
    await api.logout();
    setUser(null);
    setShift(null);
  }

  async function refreshShift() {
    const current = await api.getCurrentShift();
    setShift(current);
  }

  async function refreshUser() {
    const res = await api.me();
    setUser(res);
    setShift(res.shift);
  }

  return (
    <AuthContext.Provider value={{ user, shift, loading, login, logout, refreshShift, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
