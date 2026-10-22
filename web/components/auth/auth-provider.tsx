"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { authClient } from "@/lib/auth-client";
import type { AuthApiPayload, PublicAuthUser } from "@/lib/auth/types";

interface AuthContextValue {
  user: PublicAuthUser | null;
  loading: boolean;
  setUser: (user: PublicAuthUser | null) => void;
  refreshUser: () => Promise<PublicAuthUser | null>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<PublicAuthUser | null> {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) return null;

  const payload = (await response.json().catch(() => ({}))) as AuthApiPayload;
  return payload.user ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      return currentUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const result = await authClient.signOut("local");
    if (!result.error) setUser(null);
    return { error: result.error };
  }, []);

  useEffect(() => {
    let active = true;

    fetchCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, setUser, refreshUser, signOut }),
    [user, loading, refreshUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
