import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, setUnauthorizedHandler, tokenStore } from "./api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (code: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = "ge7.user";

interface MockAccount {
  code: string;
  password: string;
  user: User;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    code: "10000001",
    password: "admin123",
    user: { id: 1, name: "Admin G7", email: "admin@g7energy.com", code: "10000001", role: "ADMIN", permissions: [], is_admin: true },
  },
  {
    code: "20000002",
    password: "caisse123",
    user: { id: 2, name: "Caissier G7", email: "caisse@g7energy.com", code: "20000002", role: "CAISSIER", permissions: [], is_admin: false },
  },
  {
    code: "30000003",
    password: "direction123",
    user: { id: 3, name: "Direction G7", email: "direction@g7energy.com", code: "30000003", role: "DIRECTION", permissions: [], is_admin: false },
  },
];

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

const userStore = {
  get: (): User | null => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  set: (u: User) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  clear: () => localStorage.removeItem(USER_KEY),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await authApi.get<User>("/me");
      userStore.set(data);
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    void refresh();
  }, [refresh]);

  const login = useCallback(async (code: string, password: string) => {
    const { data } = await authApi.post<LoginResponse>("/login", { code, password });
    tokenStore.set(data.access_token);
    userStore.set(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.post("/logout");
    } catch {
      // ignore — nettoyage local quoi qu'il arrive
    } finally {
      tokenStore.clear();
      userStore.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
