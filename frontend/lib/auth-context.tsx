"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

export type UserRole = "ADMIN" | "COORDINATOR" | "HOD" | "DEAN" | "FACULTY";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchUser = async () => {
      const res = await api.get<{ user: User }>("/auth/me");
      if (!active) return;

      setUser(res.success && res.data ? res.data.user : null);
      setLoading(false);
    };

    void fetchUser();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User }>("/auth/login", { email, password });
    if (res.success && res.data) {
      setUser(res.data.user);
      return { success: true };
    }
    return { success: false, error: res.error || "Login failed" };
  };

  const logout = async () => {
    await api.post("/auth/logout", {});
    setUser(null);
    window.location.href = "/login";
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
