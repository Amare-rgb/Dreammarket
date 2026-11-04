// context/SettingsContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

// ============================================================
// API base — strip trailing slash
// ============================================================
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

// ============================================================
// Types
// ============================================================
export interface SettingsData {
  id?: string;
  siteName: string;
  siteDescription: string;
  storeName?: string;
  currency?: string;
  logo: string;
  favicon?: string;
  themeColor: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactHours: string;
  contactMapEmbed: string;
  enableContactForm: boolean;
  enableWhatsApp: boolean;
  whatsAppNumber: string;
  enableLiveChat: boolean;
  emergencyPhone: string;
  supportEmail: string;
  infoEmail: string;
}

// ============================================================
// Dream More brand defaults
// ============================================================
export const defaultSettings: SettingsData = {
  siteName: "Dream More Affiliate Market",
  siteDescription: "Discover trusted products and great deals.",
  storeName: "Dream More Affiliate Market",
  currency: "ETB",
  logo: "",
  themeColor: "#F47822",
  contactEmail: "info@alemayehplastic.com",
  contactPhone: "+251 900 000 000",
  contactAddress: "Bahir Dar, Ethiopia",
  contactHours: "Mon-Sat: 8:00 AM - 6:00 PM",
  contactMapEmbed: "",
  enableContactForm: true,
  enableWhatsApp: true,
  whatsAppNumber: "+251900000000",
  enableLiveChat: false,
  emergencyPhone: "+251 900 000 000",
  supportEmail: "support@alemayehplastic.com",
  infoEmail: "info@alemayehplastic.com",
};

function normalizeBrandSettings(raw: Partial<SettingsData>): SettingsData {
  const settings = { ...defaultSettings, ...raw };
  return {
    ...settings,
    siteName:
      settings.siteName === "Alemayehu Plastic Manufacturing"
        ? defaultSettings.siteName
        : settings.siteName,
    siteDescription:
      settings.siteDescription ===
      "Quality plastic products manufactured in Ethiopia"
        ? defaultSettings.siteDescription
        : settings.siteDescription,
    storeName:
      settings.storeName === "Alemayehu Plastic Manufacturing"
        ? defaultSettings.storeName
        : settings.storeName,
    themeColor:
      ["#e0a83c", "#f3733c", "#d85d32", "#eb6d3d"].includes(
        settings.themeColor?.toLowerCase()
      )
        ? defaultSettings.themeColor
        : settings.themeColor,
    logo: getFullLogoUrl(settings.logo),
  };
}

// ============================================================
// Context
// ============================================================
interface SettingsContextType {
  settings: SettingsData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  forceUpdate: () => void;
  updateSettings: (partial: Partial<SettingsData>) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: true,
  error: null,
  refetch: async () => {},
  forceUpdate: () => {},
  updateSettings: () => {},
});

// ============================================================
// Logo URL helper — Cloudinary ONLY
//   • Full https URL       → as-is (works for Cloudinary + any absolute URL)
//   • res.cloudinary.com/  → prefixed with https://
//   • Anything else        → '' (caller shows fallback)
// ============================================================
export const getFullLogoUrl = (logoPath: unknown): string => {
  if (typeof logoPath !== "string") return "";
  const s = logoPath.trim();
  if (!s) return "";

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  // ❌ Legacy `/uploads/...` paths, bare filenames → no logo
  return "";
};

// ============================================================
// Provider
// ============================================================
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Initialize from cache without a setState-in-effect
  const [settings, setSettings] = useState<SettingsData>(() => {
    if (typeof window === "undefined") return defaultSettings;

    try {
      const cached = localStorage.getItem("site_settings");
      if (!cached) return defaultSettings;

      const parsed = JSON.parse(cached);
      return normalizeBrandSettings(parsed);
    } catch (e) {
      console.error("Error reading cached settings:", e);
      return defaultSettings;
    }
  });

  // Loading is only true if there's NO cache
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !localStorage.getItem("site_settings");
  });

  const [error, setError] = useState<string | null>(null);

  // Refs so `fetchSettings` never depends on state
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ============================================================
  // fetchSettings — stable across renders (no state deps)
  // ============================================================
  const fetchSettings = useCallback(async (forceRefresh = false) => {
    if (!isMountedRef.current) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const url = forceRefresh
        ? `${API_URL}/api/admin/settings/public?_=${Date.now()}`
        : `${API_URL}/api/admin/settings/public`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;

      if (!response.ok) {
        // Don't spam the console for 5xx — treat as "keep cached value"
        if (response.status >= 500) {
          console.warn(
            `Settings API returned ${response.status}; keeping cached settings`
          );
        }
        setError("Failed to fetch settings");
        return;
      }

      const data = await response.json();
      const settingsData = data.data || data;

      const updatedSettings: SettingsData = normalizeBrandSettings({
        ...settingsData,
      });
      updatedSettings.emergencyPhone =
        settingsData.emergencyPhone || defaultSettings.emergencyPhone;
      updatedSettings.supportEmail =
        settingsData.supportEmail || defaultSettings.supportEmail;
      updatedSettings.infoEmail =
        settingsData.infoEmail || defaultSettings.infoEmail;

      setSettings(updatedSettings);
      setError(null);

      if (typeof window !== "undefined") {
        localStorage.setItem("site_settings", JSON.stringify(updatedSettings));
        window.dispatchEvent(new Event("settings-change"));
      }
    } catch (err) {
      // Silently ignore abort errors (they're expected)
      if (err instanceof Error && err.name === "AbortError") return;

      // A network error here usually means: backend is down, CORS blocked,
      // or NEXT_PUBLIC_API_URL points to the wrong host.
      console.warn(
        "Could not fetch public settings, using fallback/cache:",
        err instanceof Error ? err.message : err
      );
      if (isMountedRef.current) {
        setError("Failed to load settings");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ============================================================
  // forceUpdate — re-read from localStorage
  // ============================================================
  const forceUpdate = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      const cached = localStorage.getItem("site_settings");
      if (cached) {
        const parsed = JSON.parse(cached);
        setSettings(normalizeBrandSettings(parsed));
      } else {
        setSettings({ ...defaultSettings });
      }
    } catch (e) {
      console.error("Error reading cached settings:", e);
    }

    setLoading(false);
  }, []);

  // ============================================================
  // updateSettings — merge + persist + broadcast
  // ============================================================
  const updateSettings = useCallback((partial: Partial<SettingsData>) => {
    setSettings((prev) => {
      const merged: SettingsData = {
        ...prev,
        ...partial,
        logo:
          partial.logo !== undefined
            ? getFullLogoUrl(partial.logo)
            : prev.logo,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("site_settings", JSON.stringify(merged));
        window.dispatchEvent(new Event("settings-change"));
      }

      return merged;
    });
  }, []);

  // ============================================================
  // Mount: initial fetch + listeners
  // ============================================================
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch (once)
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      void fetchSettings();
    }

    // Safety timeout — force loading=false after 4s even if the
    // network is stuck, so the spinner never spins forever
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 4000);

    const handleSettingsChange = () => {
      if (isMountedRef.current) void fetchSettings(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isMountedRef.current) {
        void fetchSettings();
      }
    };

    const handleFocus = () => {
      if (isMountedRef.current) void fetchSettings();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "site_settings" && e.newValue && isMountedRef.current) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings(normalizeBrandSettings(parsed));
          setLoading(false);
        } catch {
          // ignore parse errors
        }
      }
    };

    window.addEventListener("settings-change", handleSettingsChange);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorageChange);

    // Poll every 5 minutes
    const interval = setInterval(() => {
      if (isMountedRef.current) void fetchSettings();
    }, 5 * 60 * 1000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(safetyTimer);
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();

      window.removeEventListener("settings-change", handleSettingsChange);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        refetch: () => fetchSettings(true),
        forceUpdate,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================
export function useSettings() {
  return useContext(SettingsContext);
}