import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";
import type { Session } from "./types";

interface AuthContextValue {
  session: Session | null;
  message: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Intentionally memory-only. Reloading the page requires login; no localStorage token.
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("");
  const login = useCallback(async (email: string, password: string) => {
    const result = await api<Session>("/auth/login", undefined, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setMessage("");
    setSession(result);
  }, []);
  const logout = useCallback(() => {
    setSession(null);
    setMessage("");
  }, []);
  const request = useCallback(
    async <T,>(path: string, options?: RequestInit) => {
      try {
        return await api<T>(path, session?.token, options);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setSession(null);
          setMessage("Your session expired. Please sign in again.");
        }
        throw error;
      }
    },
    [session?.token],
  );
  const value = useMemo(
    () => ({ session, message, login, logout, request }),
    [session, message, login, logout, request],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
