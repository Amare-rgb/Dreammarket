// app/providers.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";

// ============================================================
// API base — strip trailing slash
// ============================================================
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, "");

// ============================================================
// Axios instance
// ============================================================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ============================================================
// Types
// ============================================================
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

interface AuthContextType {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
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

interface LoginResponse {
  token: string;
  user: User;
}

interface RegisterResponse {
  token: string;
  user: User;
}

interface UserPayload {
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

// ============================================================
// Extract user from various response shapes
// ============================================================
const extractUserData = (payload: unknown): User | null => {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;

  const buildUser = (u: UserPayload): User => ({
    id: u.id,
    name: u.name || "",
    email: u.email || "",
    role: u.role || "USER",
    avatar: u.avatar || null,
    phone: u.phone || null,
    address: u.address || null,
    bio: u.bio || null,
    createdAt: u.createdAt,
  });

  if (
    data.data &&
    typeof data.data === "object" &&
    (data.data as Record<string, unknown>).id
  ) {
    return buildUser(data.data as UserPayload);
  }

  if (
    data.user &&
    typeof data.user === "object" &&
    (data.user as Record<string, unknown>).id
  ) {
    return buildUser(data.user as UserPayload);
  }

  if (data.id && typeof data.id === "string") {
    return buildUser(data as unknown as UserPayload);
  }

  return null;
};

// ============================================================
// Auth Context
// ============================================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const router = useRouter();

  // ── Initialize auth on mount ──────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          sessionStorage.getItem("token") ||
          sessionStorage.getItem("authToken");

        if (!token || token === "undefined" || token === "null") {
          setStatus("unauthenticated");
          setUser(null);
          return;
        }

        // Try stored user first (fast path)
        const storedUser =
          localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
          try {
            const parsedUser = extractUserData(JSON.parse(storedUser));
            if (parsedUser) {
              setUser(parsedUser);
              setStatus("authenticated");
            }
          } catch (e) {
            console.error("Error parsing stored user:", e);
          }
        }

        // Verify with the backend
        try {
          const response = await api.get("/api/auth/me");
          const fetchedUser = extractUserData(response.data);
          if (fetchedUser) {
            setUser(fetchedUser);
            setStatus("authenticated");
            localStorage.setItem("user", JSON.stringify(fetchedUser));
            if (fetchedUser.role) {
              localStorage.setItem("userRole", fetchedUser.role);
            }
          }
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            // Token invalid — clear everything
            localStorage.removeItem("token");
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            localStorage.removeItem("userRole");
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("authToken");
            sessionStorage.removeItem("user");
            sessionStorage.removeItem("userRole");
            setUser(null);
            setStatus("unauthenticated");
          } else {
            // Network error — trust local data
            const localUser =
              localStorage.getItem("user") || sessionStorage.getItem("user");
            if (localUser) {
              try {
                const parsed = extractUserData(JSON.parse(localUser));
                if (parsed) {
                  setUser(parsed);
                  setStatus("authenticated");
                } else {
                  setStatus("unauthenticated");
                }
              } catch {
                setStatus("unauthenticated");
              }
            } else {
              setStatus("unauthenticated");
            }
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setStatus("unauthenticated");
      }
    };

    initAuth();

    const handleAuthChange = () => {
      initAuth();
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("auth-change", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("auth-change", handleAuthChange);
    };
  }, []);

  // ── Login ─────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password,
      });

      const token = response.data.token;
      const userData = extractUserData(response.data);

      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("authToken", token);
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("authToken", token);
      }

      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("user", JSON.stringify(userData));
        if (userData.role) {
          localStorage.setItem("userRole", userData.role);
        }
        setUser(userData);
      }

      setStatus("authenticated");

      const userRole = userData?.role?.toUpperCase();
      if (userRole === "ADMIN") {
        router.push("/admin/dashboard");
      } else {
        router.push("/shop");
      }
    } catch (error: unknown) {
      const err = error as AxiosError<{ error: string }>;
      throw new Error(err.response?.data?.error || "Login failed");
    }
  };

  // ── Logout ────────────────────────────────────────────────
  const logout = (): void => {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userRole");

    setUser(null);
    setStatus("unauthenticated");
  };

  // ── Register ──────────────────────────────────────────────
  const register = async (
    name: string,
    email: string,
    password: string,
    role: string = "USER"
  ): Promise<void> => {
    try {
      const response = await api.post<RegisterResponse>("/api/auth/register", {
        name,
        email,
        password,
        role,
      });

      const token = response.data.token;
      const userData = extractUserData(response.data);

      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("authToken", token);
        sessionStorage.setItem("token", token);
        sessionStorage.setItem("authToken", token);
      }

      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
        sessionStorage.setItem("user", JSON.stringify(userData));
        if (userData.role) {
          localStorage.setItem("userRole", userData.role);
        }
        setUser(userData);
      }

      setStatus("authenticated");

      const userRole = userData?.role?.toUpperCase();
      if (userRole === "ADMIN") {
        router.push("/admin/dashboard");
      } else {
        router.push("/");
      }
    } catch (error: unknown) {
      const err = error as AxiosError<{ error: string }>;
      throw new Error(err.response?.data?.error || "Registration failed");
    }
  };

  // ── Update profile ────────────────────────────────────────
  const updateProfile = async (
    payload: ProfileUpdatePayload
  ): Promise<User> => {
    try {
      // Uses the shared Express route: PATCH /api/auth/profile
      const response = await api.patch("/api/auth/profile", payload);

      const updated =
        extractUserData(response.data) ||
        (user ? { ...user, ...payload } : null);
      if (!updated) throw new Error("Failed to parse updated user");

      setUser(updated);
      localStorage.setItem("user", JSON.stringify(updated));
      sessionStorage.setItem("user", JSON.stringify(updated));
      if (updated.role) {
        localStorage.setItem("userRole", updated.role);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-change"));
      }

      return updated;
    } catch (error: unknown) {
      const err = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to update profile"
      );
    }
  };

  // ── Upload avatar ─────────────────────────────────────────
  const uploadAvatar = async (file: File): Promise<User> => {
    try {
      const formData = new FormData();
      // Field name matches backend avatar route: "avatar"
      formData.append("avatar", file);

      // ✅ Do NOT set Content-Type manually — axios sets
      //    multipart/form-data with the correct boundary.
      // ✅ Endpoint: /api/upload/avatar → Cloudinary avatars folder
      const uploadRes = await api.post("/api/upload/avatar", formData, {
        timeout: 120000,
      });

      const url: string | undefined =
        uploadRes.data?.url ||
        uploadRes.data?.secure_url ||
        uploadRes.data?.data?.url;

      if (!url) {
        throw new Error("Upload succeeded but no URL returned");
      }

      // ✅ url is a full Cloudinary URL — save it as-is.
      const updated = await updateProfile({ avatar: url });
      return updated;
    } catch (error: unknown) {
      const err = error as AxiosError<{ error?: string; message?: string }>;
      throw new Error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to upload avatar"
      );
    }
  };

  const value: AuthContextType = {
    user,
    status,
    login,
    logout,
    register,
    updateProfile,
    uploadAvatar,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Hook
// ============================================================
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// ============================================================
// Re-export other providers
// ============================================================
export {
  useSettings,
  SettingsProvider,
  useLanguage,
  LanguageProvider,
};

// ============================================================
// Combined Providers wrapper
// ============================================================
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