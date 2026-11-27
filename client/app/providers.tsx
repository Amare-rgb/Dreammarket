// app/providers.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEYS = ["token", "authToken"] as const;
const AUTH_KEYS = ["token", "authToken", "user", "userRole"] as const;

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const k of TOKEN_KEYS) {
    const val = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (val && val !== "undefined" && val !== "null") return val;
  }
  return null;
}

function getStoredUserRaw(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("user") || sessionStorage.getItem("user");
}

function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  for (const k of AUTH_KEYS) {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  }
}

function persistSession(token?: string, user?: User | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    for (const k of TOKEN_KEYS) {
      localStorage.setItem(k, token);
      sessionStorage.setItem(k, token);
    }
  }
  if (user) {
    const serialized = JSON.stringify(user);
    localStorage.setItem("user", serialized);
    sessionStorage.setItem("user", serialized);
    if (user.role) localStorage.setItem("userRole", user.role);
  }
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  phone?: string | null;
  address?: string | null;
  bio?: string | null;
  createdAt?: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  phone?: string;
  address?: string;
  bio?: string;
  avatar?: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    name: string,
    email: string,
    password: string,
    role?: string
  ) => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<User>;
  uploadAvatar: (file: File) => Promise<User>;
}

interface AuthResponse {
  token?: string;
  user?: User;
  data?: User;
}

function buildUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id),
    name: String(raw.name || ""),
    email: String(raw.email || ""),
    role: String(raw.role || "USER"),
    avatar: (raw.avatar as string | null | undefined) ?? null,
    phone: (raw.phone as string | null | undefined) ?? null,
    address: (raw.address as string | null | undefined) ?? null,
    bio: (raw.bio as string | null | undefined) ?? null,
    createdAt: raw.createdAt as string | undefined,
  };
}

function extractUserData(payload: unknown): User | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;

  for (const key of ["data", "user"] as const) {
    const nested = data[key];
    if (nested && typeof nested === "object" && (nested as Record<string, unknown>).id) {
      return buildUser(nested as Record<string, unknown>);
    }
  }
  if (typeof data.id === "string") return buildUser(data);
  return null;
}

function parseStoredUser(): User | null {
  const raw = getStoredUserRaw();
  if (!raw) return null;
  try {
    return extractUserData(JSON.parse(raw));
  } catch (err) {
    console.error("Error parsing stored user:", err);
    return null;
  }
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const router = useRouter();

  const applySession = useCallback((nextUser: User | null, token?: string) => {
    if (nextUser) {
      persistSession(token, nextUser);
      setUser(nextUser);
      setStatus("authenticated");
    } else {
      clearStoredAuth();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const token = getStoredToken();
        if (!token) {
          if (active) {
            setUser(null);
            setStatus("unauthenticated");
          }
          return;
        }

        const cached = parseStoredUser();
        if (cached && active) {
          setUser(cached);
          setStatus("authenticated");
        }

        try {
          const response = await api.get("/api/auth/me");
          const fetched = extractUserData(response.data);
          if (fetched && active) {
            applySession(fetched);
          }
        } catch (err) {
          if (!active) return;
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            applySession(null);
          } else {
            const fallbackUser = parseStoredUser();
            setUser(fallbackUser);
            setStatus(fallbackUser ? "authenticated" : "unauthenticated");
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (active) setStatus("unauthenticated");
      }
    };

    initAuth();

    window.addEventListener("storage", initAuth);
    window.addEventListener("auth-change", initAuth);
    return () => {
      active = false;
      window.removeEventListener("storage", initAuth);
      window.removeEventListener("auth-change", initAuth);
    };
  }, [applySession]);

  const authenticate = useCallback(
    async (
      endpoint: "/api/auth/login" | "/api/auth/register",
      body: Record<string, unknown>,
      fallbackError: string,
      userRedirect: string
    ): Promise<void> => {
      try {
        const response = await api.post<AuthResponse>(endpoint, body);
        const userData = extractUserData(response.data);
        if (response.data?.token) {
          persistSession(response.data.token, userData);
        } else if (userData) {
          persistSession(undefined, userData);
        }
        setUser(userData);
        setStatus("authenticated");

        const role = userData?.role?.toUpperCase();
        router.push(role === "ADMIN" ? "/admin/dashboard" : userRedirect);
      } catch (error) {
        throw new Error(getApiErrorMessage(error, fallbackError));
      }
    },
    [router]
  );

  const login = useCallback(
    (email: string, password: string) =>
      authenticate("/api/auth/login", { email, password }, "Login failed", "/shop"),
    [authenticate]
  );

  const register = useCallback(
    (name: string, email: string, password: string, role = "USER") =>
      authenticate(
        "/api/auth/register",
        { name, email, password, role },
        "Registration failed",
        "/"
      ),
    [authenticate]
  );

  const logout = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const updateProfile = useCallback(
    async (payload: ProfileUpdatePayload): Promise<User> => {
      try {
        const response = await api.patch("/api/auth/profile", payload);
        const updated =
          extractUserData(response.data) || (user ? { ...user, ...payload } : null);
        if (!updated) throw new Error("Failed to parse updated user");

        applySession(updated);
        window.dispatchEvent(new Event("auth-change"));
        return updated;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "Failed to update profile"));
      }
    },
    [user, applySession]
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<User> => {
      try {
        const formData = new FormData();
        formData.append("avatar", file);
        const uploadRes = await api.post("/api/upload/avatar", formData, {
          timeout: 120000,
        });

        const url: string | undefined =
          uploadRes.data?.url ||
          uploadRes.data?.secure_url ||
          uploadRes.data?.data?.url;
        if (!url) throw new Error("Upload succeeded but no URL returned");

        return await updateProfile({ avatar: url });
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "Failed to upload avatar"));
      }
    },
    [updateProfile]
  );

  const value = useMemo<AuthContextType>(
    () => ({ user, status, login, logout, register, updateProfile, uploadAvatar }),
    [user, status, login, logout, register, updateProfile, uploadAvatar]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { useSettings, SettingsProvider, useLanguage, LanguageProvider };

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SettingsProvider>
          <AuthProvider>{children}</AuthProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}