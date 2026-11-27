// context/SettingsContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const CACHE_KEY = "site_settings";
const LEGACY_THEMES = ["#e0a83c", "#f3733c", "#d85d32", "#eb6d3d"];

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

export const defaultSettings: SettingsData = {
  siteName: "Dream More Affiliate Market",
  siteDescription: "Discover trusted products and great deals.",
  storeName: "Dream More Affiliate Market",
  currency: "ETB",
  logo: "",
  themeColor: "#F47822",
  contactEmail: "info@alemayehplastic.com",
  contactPhone: "+251 993 132 122",
  contactAddress: "Bahir Dar, Ethiopia",
  contactHours: "Mon-Sat: 8:00 AM - 6:00 PM",
  contactMapEmbed: "",
  enableContactForm: true,
  enableWhatsApp: true,
  whatsAppNumber: "+251993132122",
  enableLiveChat: false,
  emergencyPhone: "+251 993 132 122",
  supportEmail: "support@alemayehplastic.com",
  infoEmail: "info@alemayehplastic.com",
};

export const getFullLogoUrl = (logoPath: unknown): string => {
  if (typeof logoPath !== "string") return "";
  const s = logoPath.trim();
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("res.cloudinary.com/") ? `https://${s}` : "";
};

function normalizeSettings(raw: Partial<SettingsData>): SettingsData {
  const m = { ...defaultSettings, ...raw };
  return {
    ...m,
    siteName: m.siteName === "Alemayehu Plastic Manufacturing" ? defaultSettings.siteName : m.siteName,
    siteDescription: m.siteDescription === "Quality plastic products manufactured in Ethiopia" ? defaultSettings.siteDescription : m.siteDescription,
    storeName: m.storeName === "Alemayehu Plastic Manufacturing" ? defaultSettings.storeName : m.storeName,
    themeColor: LEGACY_THEMES.includes(m.themeColor?.toLowerCase()) ? defaultSettings.themeColor : m.themeColor,
    emergencyPhone: m.emergencyPhone || defaultSettings.emergencyPhone,
    supportEmail: m.supportEmail || defaultSettings.supportEmail,
    infoEmail: m.infoEmail || defaultSettings.infoEmail,
    logo: getFullLogoUrl(m.logo),
  };
}

function readCachedSettings(): SettingsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function persistSettings(next: SettingsData, notify = true) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  if (notify) window.dispatchEvent(new Event("settings-change"));
}

interface SettingsContextValue {
  settings: SettingsData;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  forceUpdate: () => void;
  updateSettings: (partial: Partial<SettingsData>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: defaultSettings,
  loading: true,
  error: null,
  refetch: async () => {},
  forceUpdate: () => {},
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsData>(() => readCachedSettings() ?? defaultSettings);
  const [loading, setLoading] = useState<boolean>(() => (typeof window === "undefined" ? true : !localStorage.getItem(CACHE_KEY)));
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSettings = useCallback(async (forceRefresh = false) => {
    if (!mountedRef.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const query = forceRefresh ? `?_=${Date.now()}` : "";
      const res = await fetch(`${API_URL}/api/admin/settings/public${query}`, {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!mountedRef.current) return;

      if (!res.ok) {
        if (res.status >= 500) console.warn(`Settings API returned ${res.status}; keeping cache`);
        setError("Failed to fetch settings");
        return;
      }

      const payload = await res.json();
      const updated = normalizeSettings(payload?.data || payload || {});
      setSettings(updated);
      setError(null);
      persistSettings(updated);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") return;
      console.warn("Could not fetch public settings:", err instanceof Error ? err.message : err);
      if (mountedRef.current) setError("Failed to load settings");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const forceUpdate = useCallback(() => {
    setSettings(readCachedSettings() ?? { ...defaultSettings });
    setLoading(false);
  }, []);

  const updateSettings = useCallback((partial: Partial<SettingsData>) => {
    setSettings((prev) => {
      const merged = normalizeSettings({ ...prev, ...partial, logo: partial.logo !== undefined ? partial.logo : prev.logo });
      persistSettings(merged);
      return merged;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialFetch = setTimeout(() => void fetchSettings(), 0);

    const safety = setTimeout(() => mountedRef.current && setLoading(false), 4000);
    const interval = setInterval(() => mountedRef.current && void fetchSettings(), 5 * 60 * 1000);
    const onChange = () => mountedRef.current && void fetchSettings(true);
    const onVisible = () => document.visibilityState === "visible" && mountedRef.current && void fetchSettings();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY && e.newValue && mountedRef.current) {
        try {
          setSettings(normalizeSettings(JSON.parse(e.newValue)));
          setLoading(false);
        } catch {}
      }
    };

    window.addEventListener("settings-change", onChange);
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("storage", onStorage);

    return () => {
      mountedRef.current = false;
      clearTimeout(initialFetch);
      clearTimeout(safety);
      clearInterval(interval);
      abortRef.current?.abort();
      window.removeEventListener("settings-change", onChange);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchSettings]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, error, refetch: () => fetchSettings(true), forceUpdate, updateSettings }),
    [settings, loading, error, fetchSettings, forceUpdate, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
export const useSettings = () => useContext(SettingsContext);