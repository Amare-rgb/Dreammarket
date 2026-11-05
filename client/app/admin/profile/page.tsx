// app/admin/profile/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Mail,
  Phone,
  Calendar,
  Edit2,
  Save,
  X,
  User,
  Shield,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import axios, { AxiosError } from "axios";

// ============================================================
// API base
// ============================================================
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_URL = RAW_API_BASE.replace(/\/+$/, "");

// ============================================================
// Avatar resolver — Cloudinary ONLY
//   • Full https URL      → as-is
//   • res.cloudinary.com  → prefixed with https://
//   • Anything else       → "" (caller shows initial letter)
// ============================================================
function resolveAvatar(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  return "";
}

// ============================================================
// Axios
// ============================================================
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("token");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/auth/signin";
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// Types
// ============================================================
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Avatar display — 2-stage fallback (URL → initial letter)
// ============================================================
function AdminAvatar({ src, name }: { src: string; name: string }) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setImgSrc(src);
    setFailed(false);
  }

  if (!imgSrc || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[#1a1410] bg-gradient-to-br from-yellow-200 to-yellow-400">
        {name?.charAt(0)?.toUpperCase() || "A"}
      </div>
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={name || "Admin"}
      width={80}
      height={80}
      className="object-cover w-full h-full"
      onError={() => setFailed(true)}
      unoptimized
    />
  );
}

// ============================================================
// Main component
// ============================================================
export default function AdminProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const hasFetched = useRef(false);

  // ── Auth check ───────────────────────────────────────────
  useEffect(() => {
    const checkAuth = () => {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");
      const userData =
        localStorage.getItem("user") || sessionStorage.getItem("user");

      if (!token) {
        router.replace("/auth/signin");
        setAuthLoading(false);
        return;
      }

      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          if (parsedUser.role?.toUpperCase() !== "ADMIN") {
            router.replace("/");
            setAuthLoading(false);
            return;
          }
          setIsAuthenticated(true);
        } catch {
          router.replace("/auth/signin");
        }
      } else {
        router.replace("/auth/signin");
      }
      setAuthLoading(false);
    };

    checkAuth();
  }, [router]);

  // ── Fetch profile ────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || hasFetched.current) return;
    hasFetched.current = true;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await api.get("/api/profile/me");

        let user: UserProfile | null = null;
        if (response.data?.user) user = response.data.user;
        else if (response.data?.data) user = response.data.data;
        else if (response.data) user = response.data;

        if (user) {
          setProfile(user);
          setFormData({
            name: user.name || "",
            phone: user.phone || "",
          });
        } else {
          setMessage({ type: "error", text: "Failed to load profile" });
        }
      } catch (error) {
        console.error("❌ Error fetching profile:", error);
        setMessage({ type: "error", text: "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  // ── Auto-clear messages after 4s ─────────────────────────
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const response = await api.put("/api/profile/update", formData);

      if (response.data.success) {
        const updatedUser =
          response.data.user || response.data.data || response.data;

        setMessage({
          type: "success",
          text: "Profile updated successfully!",
        });
        setProfile(updatedUser);
        setFormData({
          name: updatedUser.name || "",
          phone: updatedUser.phone || "",
        });
        setEditing(false);

        localStorage.setItem("user", JSON.stringify(updatedUser));
        sessionStorage.setItem("user", JSON.stringify(updatedUser));
      } else {
        setMessage({
          type: "error",
          text: response.data.error || "Failed to update profile",
        });
      }
    } catch (error) {
      console.error("❌ Update error:", error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{ error: string }>;
        setMessage({
          type: "error",
          text:
            axiosError.response?.data?.error || "Failed to update profile",
        });
      } else {
        setMessage({ type: "error", text: "An error occurred" });
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  const resolvedAvatar = resolveAvatar(profile?.avatar);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">
          Profile Settings
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage your admin account information
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
            message.type === "success"
              ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
              : message.type === "info"
              ? "bg-blue-50 border border-blue-200 text-blue-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.type === "success" && (
            <CheckCircle className="w-4 h-4" />
          )}
          {message.type === "error" && (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-sm">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Personal Information
            </h3>
            {profile?.role && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                {profile.role}
              </span>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-yellow-600 hover:text-yellow-700 flex items-center gap-1 px-3 py-1.5 border border-yellow-200 rounded-lg hover:bg-yellow-50 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        <div className="p-6">
          {!editing ? (
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 border-2 border-gray-100">
                <AdminAvatar
                  src={resolvedAvatar}
                  name={profile?.name || "Admin"}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {profile?.name || "Loading..."}
                  </h3>
                </div>

                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{profile?.email || "No email"}</span>
                  </div>
                  {profile?.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{profile.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Joined{" "}
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            }
                          )
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Access</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email — display only */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  {profile?.email}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm px-3 py-2 border"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700"
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm px-3 py-2 border"
                  placeholder="+251 993 132 122"
                />
                <p className="text-xs text-gray-400 mt-1">Optional</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      name: profile?.name || "",
                      phone: profile?.phone || "",
                    });
                    setMessage(null);
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Admin Info Card */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-yellow-800">
              Admin Account — Dream More Affiliate Market
            </h4>
            <p className="text-xs text-yellow-700 mt-1">
              You have full administrative access to manage products,
              categories, users, and settings. Please keep your account
              information up to date.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}