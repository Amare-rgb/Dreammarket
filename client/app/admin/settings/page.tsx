// app/admin/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import { useSettings } from "@/hooks/useSettings";
import { Settings, Save, CheckCircle, AlertCircle, Info, XCircle, Shield, Loader2, Store, Eye, EyeOff, Upload, Image as ImageIcon, Trash2, Mail, Phone, MapPin, Clock, Truck } from "lucide-react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const api = axios.create({ baseURL: API_URL, headers: { "Content-Type": "application/json" }, withCredentials: true });

const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || localStorage.getItem("token") || sessionStorage.getItem("token");
};
api.interceptors.request.use((config) => { const t = getStoredToken(); if (t) config.headers.Authorization = `Bearer ${t}`; return config; });

const resolveLogo = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim(); if (!s) return null;
  if (s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
};

type NotifType = "success" | "error" | "info" | "warning";
const NOTIF_STYLES: Record<NotifType, string> = {
  success: "bg-yellow-50 border-yellow-200 text-yellow-800", error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800", info: "bg-blue-50 border-blue-200 text-blue-800",
};
const NOTIF_ICONS: Record<NotifType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-yellow-500" />, error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-yellow-500" />, info: <Info className="w-5 h-5 text-blue-500" />,
};

const Notification: React.FC<{ type: NotifType; message: string; onClose: () => void }> = ({ type, message, onClose }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}`}>
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${NOTIF_STYLES[type]}`}>
        {NOTIF_ICONS[type]}<p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="text-gray-400 hover:text-gray-600"><XCircle className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const SettingSection: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50"><h3 className="text-sm font-semibold text-gray-900">{title}</h3><p className="text-xs text-gray-500 mt-0.5">{description}</p></div>
    <div className="p-6 space-y-4">{children}</div>
  </div>
);

const ToggleSwitch: React.FC<{ label: string; description?: string; checked: boolean; onChange: () => void }> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <div><p className="text-sm font-medium text-gray-700">{label}</p>{description && <p className="text-xs text-gray-500">{description}</p>}</div>
    <button type="button" onClick={onChange} className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 ${checked ? "bg-yellow-500" : "bg-gray-200"}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  </div>
);

const INPUT = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm";
const LABEL = "block text-sm font-medium text-gray-700 mb-1.5";

interface SettingsData {
  siteName: string; siteDescription: string; adminEmail: string; adminPhone: string; address: string;
  timezone: string; dateFormat: string; storeName: string; storeEmail: string; storePhone: string; storeAddress: string;
  currency: string; taxRate: number; twoFactorAuth: boolean; sessionTimeout: number; logo: string;
  contactEmail: string; contactPhone: string; contactAddress: string; contactHours: string; enableContactForm: boolean;
  themeColor: string; darkMode: boolean; emailNotifications: boolean; orderNotifications: boolean; productNotifications: boolean;
  userNotifications: boolean; marketingEmails: boolean; storeLatitude: string; storeLongitude: string;
  deliveryBaseFee: number; deliveryPerKmRate: number; deliveryTiers: string; freeDeliveryAbove: number; maxDeliveryRadiusKm: number;
}
interface PasswordData { currentPassword: string; newPassword: string; confirmPassword: string; }
interface ApiErrorResponse { error: string; message?: string; }

const defaultSettings: SettingsData = {
  siteName: "Dream More Affiliate Market", siteDescription: "Discover trusted products and great deals.",
  adminEmail: "admin@alemayehplastic.com", adminPhone: "+251 993 132 122", address: "Bahir Dar, Ethiopia",
  timezone: "Africa/Addis_Ababa", dateFormat: "DD/MM/YYYY", storeName: "Dream More Affiliate Market",
  storeEmail: "info@alemayehplastic.com", storePhone: "+251 993 132 122", storeAddress: "Bahir Dar, Ethiopia",
  currency: "ETB", taxRate: 15, twoFactorAuth: false, sessionTimeout: 60, logo: "",
  contactEmail: "support@alemayehplastic.com", contactPhone: "+251 993 132 122", contactAddress: "Bahir Dar, Ethiopia",
  contactHours: "Mon-Sat: 8:00 AM - 6:00 PM", enableContactForm: true, themeColor: "#F47822", darkMode: false,
  emailNotifications: true, orderNotifications: true, productNotifications: true, userNotifications: true,
  marketingEmails: false, storeLatitude: "", storeLongitude: "", deliveryBaseFee: 0, deliveryPerKmRate: 0,
  deliveryTiers: "", freeDeliveryAbove: 0, maxDeliveryRadiusKm: 30,
};

const SettingsPage: React.FC = () => {
  const router = useRouter();
  const isMounted = useRef(true);
  const hasInitialized = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const [notification, setNotification] = useState<{ type: NotifType; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [showPassword, setShowPassword] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoToDelete, setLogoToDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordData, setPasswordData] = useState<PasswordData>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [formData, setFormData] = useState<SettingsData>(defaultSettings);
  const { updateSettings } = useSettings();

  const tabs = [
    { id: "general", label: "General", icon: Settings }, { id: "store", label: "Store", icon: Store },
    { id: "contact", label: "Contact", icon: Mail }, { id: "delivery", label: "Delivery", icon: Truck },
    { id: "security", label: "Security", icon: Shield },
  ];
  const currencies = ["ETB", "USD", "EUR", "GBP", "KES"];
  const timezones = ["Africa/Addis_Ababa", "Africa/Nairobi", "Africa/Dar_es_Salaam", "Africa/Kampala", "Africa/Kigali"];

  const showNotification = (type: NotifType, message: string) => setNotification({ type, message });
  const clearNotification = () => setNotification(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "number" ? parseFloat(value) || 0 : value }));
  };
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };
  const handleToggle = (name: string) => setFormData((prev) => ({ ...prev, [name]: !prev[name as keyof typeof prev] }));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) { showNotification("error", "Please select a valid image file (JPEG, PNG, GIF, WEBP, SVG)"); return; }
    if (file.size > 5 * 1024 * 1024) { showNotification("error", "Logo file size must be less than 5MB"); return; }
    setLogoFile(file); setLogoToDelete(false); setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => { setLogoFile(null); setLogoPreview(null); setLogoToDelete(true); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const loadSettingsData = useCallback(async () => {
    setLoading(true);
    try {
      if (!getStoredToken()) { setFormData(defaultSettings); return; }
      const response = await api.get("/api/admin/settings");
      if (response.data && isMounted.current) {
        const settingsData = response.data.data || response.data;
        setFormData((prev) => ({ ...defaultSettings, ...prev, ...settingsData }));
        setLogoPreview(resolveLogo(settingsData.logo)); setLogoToDelete(false);
      }
    } catch (err) {
      console.error("❌ Error fetching settings:", err as AxiosError<ApiErrorResponse>);
      setFormData(defaultSettings);
    } finally { if (isMounted.current) setLoading(false); }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (!hasInitialized.current) { hasInitialized.current = true; loadSettingsData(); }
    return () => { isMounted.current = false; };
  }, [loadSettingsData]);

  const safeUpdateSettings = useCallback((data: Partial<SettingsData>) => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      updateSettings(data);
      const current = localStorage.getItem("site_settings");
      if (current) {
        try { localStorage.setItem("site_settings", JSON.stringify({ ...JSON.parse(current), ...data })); }
        catch { localStorage.setItem("site_settings", JSON.stringify(data)); }
      } else localStorage.setItem("site_settings", JSON.stringify(data));
      window.dispatchEvent(new Event("settings-change"));
    });
  }, [updateSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!getStoredToken()) { showNotification("error", "Authentication required. Please login again."); router.push("/auth/signin"); return; }
      const fd = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key !== "logo") { const value = formData[key as keyof SettingsData]; if (value !== undefined && value !== null) fd.append(key, String(value)); }
      });
      if (formData.logo) fd.append("logo", formData.logo);
      const response = await api.post("/api/admin/settings", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const isSuccess = response.data?.success || response.data?.status === "success";
      if (isSuccess) {
        showNotification("success", response.data.message || "Settings saved successfully! 🎉");
        if (typeof window !== "undefined") {
          const u = response.data.settings || response.data;
          safeUpdateSettings({ siteName: u.siteName || "", siteDescription: u.siteDescription || "", contactEmail: u.contactEmail || "", contactPhone: u.contactPhone || "", contactAddress: u.contactAddress || "", contactHours: u.contactHours || "", logo: u.logo || "" });
        }
        await loadSettingsData();
      } else showNotification("error", response.data?.error || response.data?.message || "Failed to save settings");
    } catch (err) {
      const error = err as AxiosError<ApiErrorResponse>;
      console.error("❌ Error saving settings:", error);
      if (error.response?.status === 401) { showNotification("error", "Authentication failed. Please login again."); router.push("/auth/signin"); }
      else showNotification("error", error.response?.data?.error || "Failed to save settings");
    } finally { setSaving(false); }
  };

  const handleSaveLogo = async () => {
    setSavingLogo(true);
    try {
      if (!getStoredToken()) { showNotification("error", "Authentication required. Please login again."); router.push("/auth/signin"); return; }
      if (!logoFile && !logoToDelete) { showNotification("warning", "Please select a logo to upload or click remove to delete"); return; }
      const fd = new FormData();
      if (logoToDelete) fd.append("logo", "");
      else if (logoFile) fd.append("logo", logoFile);
      const response = await api.post("/api/admin/settings", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const isSuccess = response.data?.success || response.data?.status === "success";
      if (isSuccess) {
        showNotification("success", response.data.message || "Logo updated successfully! 🎉");
        if (typeof window !== "undefined") {
          const u = response.data.settings || response.data;
          safeUpdateSettings({ logo: u.logo || "", siteName: u.siteName || "", contactEmail: u.contactEmail || "", contactPhone: u.contactPhone || "", contactAddress: u.contactAddress || "", contactHours: u.contactHours || "" });
        }
        setLogoFile(null); setLogoToDelete(false);
        await loadSettingsData();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else showNotification("error", response.data?.error || response.data?.message || "Failed to update logo");
    } catch (err) {
      const error = err as AxiosError<ApiErrorResponse>;
      console.error("❌ Error saving logo:", error);
      if (error.response?.status === 401) { showNotification("error", "Authentication failed. Please login again."); router.push("/auth/signin"); }
      else showNotification("error", error.response?.data?.error || "Failed to update logo");
    } finally { setSavingLogo(false); }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword) return showNotification("error", "Please enter your current password");
    if (!passwordData.newPassword) return showNotification("error", "Please enter a new password");
    if (passwordData.newPassword.length < 8) return showNotification("error", "New password must be at least 8 characters");
    if (!/\d/.test(passwordData.newPassword)) return showNotification("error", "New password must contain at least one number");
    if (passwordData.newPassword !== passwordData.confirmPassword) return showNotification("error", "Passwords do not match");
    try {
      if (!getStoredToken()) { showNotification("error", "Authentication required"); router.push("/auth/signin"); return; }
      const response = await api.post("/api/admin/settings/change-password", { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword });
      if (response.data.success) {
        showNotification("success", response.data.message || "Password changed successfully");
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else showNotification("error", response.data.error || "Failed to change password");
    } catch (err) {
      const error = err as AxiosError<ApiErrorResponse>;
      console.error("Error changing password:", error);
      if (error.response?.status === 401) router.push("/auth/signin");
      else showNotification("error", error.response?.data?.error || "Failed to change password");
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset all settings to default?")) return;
    try {
      if (!getStoredToken()) { showNotification("error", "Authentication required"); return; }
      const response = await api.post("/api/admin/settings/reset");
      if (response.data.success) {
        setFormData(defaultSettings); setLogoPreview(null); setLogoFile(null); setLogoToDelete(false);
        showNotification("success", "Settings reset to default successfully");
        await loadSettingsData();
        if (typeof window !== "undefined") safeUpdateSettings(defaultSettings);
      } else showNotification("error", response.data.error || "Failed to reset settings");
    } catch (err) {
      const error = err as AxiosError<ApiErrorResponse>;
      console.error("Error resetting settings:", error);
      showNotification("error", error.response?.data?.error || "Failed to reset settings");
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div><p className="mt-4 text-gray-600">Loading settings...</p></div></div>;

  const saveBtn = (label: string) => (
    <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 px-4 py-2 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      <span>{saving ? "Saving..." : label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {notification && <Notification type={notification.type} message={notification.message} onClose={clearNotification} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-lg font-semibold text-gray-900">Settings</h1><p className="text-xs text-gray-500 mt-0.5">Manage your application settings and preferences</p></div>
        {saveBtn("Save Settings")}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto px-4 py-2 space-x-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${isActive ? "bg-yellow-50 text-yellow-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                  <tab.icon className={`w-4 h-4 ${isActive ? "text-yellow-600" : ""}`} /><span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* General */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <SettingSection title="Logo & Branding" description="Upload your website logo and configure branding">
                <div>
                  <label className={LABEL}>Website Logo</label>
                  <div className="flex items-start space-x-4">
                    <div className="relative">
                      <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50">
                        {logoPreview ? (<Image src={logoPreview} alt="Logo preview" fill unoptimized sizes="128px" className="object-cover" />) : (<ImageIcon className="w-12 h-12 text-gray-400" />)}
                      </div>
                      {logoPreview && !logoToDelete && (<button type="button" onClick={removeLogo} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"><Trash2 className="w-4 h-4" /></button>)}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col space-y-2">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="logo-upload" />
                        <div className="flex flex-wrap gap-2">
                          <label htmlFor="logo-upload" className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors text-sm"><Upload className="w-4 h-4" /><span>Choose Image</span></label>
                          <button type="button" onClick={handleSaveLogo} disabled={savingLogo || (!logoFile && !logoToDelete)} className="flex items-center space-x-2 px-4 py-2 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
                            {savingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}<span>{savingLogo ? "Saving Logo..." : "Save Logo"}</span>
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">Recommended: PNG or SVG, max 5MB</p>
                        {logoPreview && !logoToDelete && logoFile && <p className="text-xs text-yellow-600">✓ New logo selected — click Save Logo to update</p>}
                        {logoToDelete && <p className="text-xs text-red-600">⚠️ Logo will be removed — click Save Logo to confirm</p>}
                        {formData.logo && !logoFile && !logoToDelete && <p className="text-xs text-blue-600">✓ Current logo is saved</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </SettingSection>

              <SettingSection title="General Settings" description="Basic information about your application">
                <div><label className={LABEL}>Site Name <span className="text-red-500">*</span></label><input type="text" name="siteName" value={formData.siteName} onChange={handleChange} placeholder="Enter site name" className={INPUT} /></div>
                <div><label className={LABEL}>Site Description</label><textarea name="siteDescription" value={formData.siteDescription} onChange={handleChange} placeholder="Enter site description" className={`${INPUT} min-h-[100px]`} /></div>
                <div><label className={LABEL}>Admin Email <span className="text-red-500">*</span></label><input type="email" name="adminEmail" value={formData.adminEmail} onChange={handleChange} placeholder="admin@alemayehplastic.com" className={INPUT} /></div>
                <div><label className={LABEL}>Admin Phone</label><input type="tel" name="adminPhone" value={formData.adminPhone} onChange={handleChange} placeholder="+251 993 132 122" className={INPUT} /></div>
                <div><label className={LABEL}>Address</label><input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Enter business address" className={INPUT} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={LABEL}>Timezone</label><select name="timezone" value={formData.timezone} onChange={handleChange} className={INPUT}>{timezones.map((tz) => <option key={tz} value={tz}>{tz.replace("/", " / ")}</option>)}</select></div>
                  <div><label className={LABEL}>Date Format</label><select name="dateFormat" value={formData.dateFormat} onChange={handleChange} className={INPUT}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></div>
                </div>
              </SettingSection>
            </div>
          )}

          {/* Store */}
          {activeTab === "store" && (
            <div className="space-y-6">
              <SettingSection title="Store Settings" description="Configure your store information and preferences">
                <div><label className={LABEL}>Store Name <span className="text-red-500">*</span></label><input type="text" name="storeName" value={formData.storeName} onChange={handleChange} placeholder="Enter store name" className={INPUT} /></div>
                <div><label className={LABEL}>Store Email <span className="text-red-500">*</span></label><input type="email" name="storeEmail" value={formData.storeEmail} onChange={handleChange} placeholder="info@alemayehplastic.com" className={INPUT} /></div>
                <div><label className={LABEL}>Store Phone</label><input type="tel" name="storePhone" value={formData.storePhone} onChange={handleChange} placeholder="+251 993 132 122" className={INPUT} /></div>
                <div><label className={LABEL}>Store Address</label><input type="text" name="storeAddress" value={formData.storeAddress} onChange={handleChange} placeholder="Enter store address" className={INPUT} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={LABEL}>Currency</label><select name="currency" value={formData.currency} onChange={handleChange} className={INPUT}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label className={LABEL}>Tax Rate (%)</label><input type="number" name="taxRate" value={formData.taxRate} onChange={handleChange} placeholder="15" className={INPUT} /><p className="text-xs text-gray-400 mt-1">Default tax rate applied to products</p></div>
                </div>
              </SettingSection>
            </div>
          )}

          {/* Contact */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <SettingSection title="Contact Information" description="Configure contact details for your website">
                <div><label className={LABEL}>Contact Email <span className="text-red-500">*</span></label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleChange} placeholder="support@alemayehplastic.com" className={`${INPUT} pl-10`} /></div></div>
                <div><label className={LABEL}>Contact Phone</label><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="tel" name="contactPhone" value={formData.contactPhone} onChange={handleChange} placeholder="+251 993 132 122" className={`${INPUT} pl-10`} /></div></div>
                <div><label className={LABEL}>Contact Address</label><div className="relative"><MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><textarea name="contactAddress" value={formData.contactAddress} onChange={handleChange} rows={2} placeholder="Bahir Dar, Ethiopia" className={`${INPUT} pl-10`} /></div></div>
                <div><label className={LABEL}>Business Hours</label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" name="contactHours" value={formData.contactHours} onChange={handleChange} placeholder="Mon-Sat: 8:00 AM - 6:00 PM" className={`${INPUT} pl-10`} /></div></div>
                <div className="pt-4 border-t border-gray-200"><ToggleSwitch label="Enable Contact Form" description="Show contact form on the contact page" checked={formData.enableContactForm} onChange={() => handleToggle("enableContactForm")} /></div>
              </SettingSection>
            </div>
          )}

          {/* Delivery */}
          {activeTab === "delivery" && (
            <div className="space-y-6">
              <SettingSection title="Store Location" description="Set your store's GPS coordinates for distance-based delivery pricing">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={LABEL}>Store Latitude</label><input type="number" name="storeLatitude" step="any" value={formData.storeLatitude} onChange={handleChange} placeholder="e.g. 11.5742" className={INPUT} /></div>
                  <div><label className={LABEL}>Store Longitude</label><input type="number" name="storeLongitude" step="any" value={formData.storeLongitude} onChange={handleChange} placeholder="e.g. 37.3618" className={INPUT} /></div>
                </div>
                <p className="text-xs text-gray-400">Find coordinates on Google Maps (right-click the store pin → copy lat/lng). Required for distance-based delivery fees.</p>
              </SettingSection>
              <SettingSection title="Delivery Pricing" description="Configure how delivery fees are calculated at checkout">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={LABEL}>Base delivery fee (ETB)</label><input type="number" name="deliveryBaseFee" min="0" step="0.01" value={formData.deliveryBaseFee} onChange={handleChange} placeholder="e.g. 50" className={INPUT} /></div>
                  <div><label className={LABEL}>Per-km rate (ETB)</label><input type="number" name="deliveryPerKmRate" min="0" step="0.01" value={formData.deliveryPerKmRate} onChange={handleChange} placeholder="e.g. 10" className={INPUT} /></div>
                </div>
                <p className="text-xs text-gray-400">Fee = base fee + (distance in km × per-km rate). Used when no distance tiers are set below.</p>
                <div><label className={LABEL}>Distance tiers (JSON, optional)</label><textarea name="deliveryTiers" value={formData.deliveryTiers} onChange={handleChange} rows={4} placeholder='[{"maxKm":5,"fee":50},{"maxKm":15,"fee":100},{"maxKm":null,"fee":200}]' className={`${INPUT} font-mono`} /><p className="text-xs text-gray-400 mt-1">Overrides base+per-km when set. Each tier: maxKm (null = unlimited) and flat fee. Leave empty to use base + per-km.</p></div>
                <div><label className={LABEL}>Free delivery above (ETB)</label><input type="number" name="freeDeliveryAbove" min="0" step="0.01" value={formData.freeDeliveryAbove} onChange={handleChange} placeholder="e.g. 2000 — 0 to disable" className={INPUT} /><p className="text-xs text-gray-400 mt-1">Orders with subtotal above this amount get free delivery. Set 0 to disable.</p></div>
                <div><label className={LABEL}>Maximum delivery radius (km)</label><input type="number" name="maxDeliveryRadiusKm" min="0" step="0.1" value={formData.maxDeliveryRadiusKm} onChange={handleChange} placeholder="e.g. 30" className={INPUT} /><p className="text-xs text-gray-400 mt-1">Orders with GPS coordinates farther than this from the store are rejected as out-of-area.</p></div>
              </SettingSection>
            </div>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <SettingSection title="Security Settings" description="Configure security preferences for your account">
                <div className="space-y-4">
                  <div><label className={LABEL}>Current Password</label><input type={showPassword ? "text" : "password"} name="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} placeholder="Enter current password" className={INPUT} /></div>
                  <div><label className={LABEL}>New Password</label><input type={showPassword ? "text" : "password"} name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} placeholder="Enter new password" className={INPUT} /><p className="text-xs text-gray-400 mt-1">Minimum 8 characters, must include a number</p></div>
                  <div><label className={LABEL}>Confirm Password</label><input type={showPassword ? "text" : "password"} name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} placeholder="Confirm new password" className={INPUT} /></div>
                  <div className="flex items-center justify-between">
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}<span>{showPassword ? "Hide Passwords" : "Show Passwords"}</span></button>
                    <button type="button" onClick={handleChangePassword} className="px-4 py-2 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] text-sm">Change Password</button>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200"><ToggleSwitch label="Two-Factor Authentication" description="Add an extra layer of security to your account" checked={formData.twoFactorAuth} onChange={() => handleToggle("twoFactorAuth")} /></div>
                <div><label className={LABEL}>Session Timeout (minutes)</label><input type="number" name="sessionTimeout" value={formData.sessionTimeout} onChange={handleChange} min="5" max="480" className={INPUT} /><p className="text-xs text-gray-400 mt-1">Auto-logout after inactivity (5-480 minutes)</p></div>
              </SettingSection>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={handleReset} className="text-sm text-red-600 hover:text-red-700">Reset to Default</button>
        {saveBtn("Save All Settings")}
      </div>
    </div>
  );
};

export default SettingsPage;