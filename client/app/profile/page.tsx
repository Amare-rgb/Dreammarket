// app/profile/page.tsx
"use client";

import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Camera, Check, ChevronRight, Edit3, Gift, LogOut, Mail, MapPin, Phone, Shield, Star, Ticket, User, X } from "lucide-react";
import { useAuth } from "@/app/providers";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/api";

interface RewardRuleProgress {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  threshold: number;
  rewardType: string;
  rewardValue: string;
  promoCode: string | null;
  progress: number;
  percent: number;
  qualified: boolean;
}

interface MyRewards {
  totalSpend: number;
  rules: RewardRuleProgress[];
  qualifiedOrders: { id: string; orderNumber: string; rule: { name: string } }[];
  dispatches: { id: string; status: string; rewardRule: { name: string } | null }[];
}

interface ProfileForm { name: string; phone: string; address: string; bio: string; }

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const INPUT_CLS = "w-full rounded-xl border border-[#f0e8d8] bg-[#faf6ee]/50 px-4 py-2.5 text-sm font-medium text-[#1a1410] transition-all focus:border-[#e0a83c] focus:outline-none focus:ring-2 focus:ring-[#e0a83c]/30";
const READONLY_CLS = "rounded-xl bg-[#faf6ee]/40 px-4 py-2.5 text-sm font-medium text-[#1a1410]";
const REWARD_LABELS: Record<string, (v: string) => string> = {
  PERCENT_DISCOUNT: (v) => `${v}% discount`,
  FIXED_CASHBACK: (v) => `${v} ETB cashback`,
  FREE_ITEM: (v) => `Free: ${v}`,
  MOBILE_AIRTIME: (v) => `${v} ETB airtime`,
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(amount);

const rewardLabel = (type: string, value: string) => REWARD_LABELS[type]?.(value) || value || "Reward";

function resolveAvatar(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("data:") || s.startsWith("blob:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("res.cloudinary.com/") ? `https://${s}` : "";
}

function formatMemberSince(createdAt?: string | null): string {
  if (!createdAt) return "—";
  try {
    return new Date(createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

const toProfileForm = (u?: { name?: string | null; phone?: string | null; address?: string | null; bio?: string | null } | null): ProfileForm => ({
  name: u?.name || "",
  phone: u?.phone || "",
  address: u?.address || "",
  bio: u?.bio || "",
});

function AvatarImage({ src, alt, initials }: { src: string; alt: string; initials: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-yellow-500 to-yellow-700">
        <span className="font-serif text-2xl font-bold text-white">{initials}</span>
      </div>
    );
  }
  return <Image src={src} alt={alt} fill className="object-cover" sizes="96px" priority unoptimized onError={() => setFailed(true)} />;
}

export default function ProfilePage() {
  const { user, status, logout, updateProfile, uploadAvatar } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>(() => toProfileForm(user));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [rewards, setRewards] = useState<MyRewards | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const notify = (kind: "success" | "error", message: string, ms = 3500) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast((cur) => (cur?.message === message ? null : cur)), ms);
  };

  // Sync form data when the user object changes — render-phase adjustment
  // (React's recommended alternative to setState-in-effect).
  const userKey = user ? [user.id, user.name, user.phone, user.address, user.bio].join("|") : "";
  const [prevUserKey, setPrevUserKey] = useState(userKey);
  if (userKey !== prevUserKey) {
    setPrevUserKey(userKey);
    setFormData(toProfileForm(user));
  }

  useEffect(() => () => { if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  useEffect(() => {
    if (status === "unauthenticated" && !loggingOut) {
      const id = window.setTimeout(() => router.replace("/"), 0);
      return () => window.clearTimeout(id);
    }
  }, [status, router, loggingOut]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    let cancelled = false;
    api.get("/api/rewards/me").then((res) => !cancelled && res.data?.success && setRewards(res.data)).catch(() => {});
    return () => { cancelled = true; };
  }, [status, user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logout(); } catch (err) { console.error("Logout error:", err); } finally { router.replace("/"); }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) return notify("error", t("profile.error_image_size", "Image must be smaller than 5 MB"), 4000);
    if (!file.type.startsWith("image/")) return notify("error", t("profile.error_image_type", "Please choose an image file"), 4000);

    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      await uploadAvatar(file);
      setAvatarPreview(null);
      notify("success", t("profile.toast_saved", "Profile updated successfully!"));
    } catch (err) {
      setAvatarPreview(null);
      notify("error", err instanceof Error ? err.message : t("profile.error_avatar_upload", "Failed to upload avatar"), 4000);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(formData);
      setIsEditing(false);
      notify("success", t("profile.toast_saved", "Profile updated successfully!"));
    } catch (err) {
      notify("error", err instanceof Error ? err.message : t("profile.error_profile_save", "Failed to save profile"), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="profile-theme flex min-h-screen items-center justify-center bg-[var(--cream)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#3a2a1e] border-t-[#e0a83c]" />
          <p className="font-sans text-sm text-[#7a6a58]">{t("profile.loading", "Loading your profile...")}</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  const userInitials = user.name?.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase() || "U";
  const avatarSrc = avatarPreview || resolveAvatar(user.avatar);
  const memberSince = formatMemberSince((user as { createdAt?: string }).createdAt);
  const emptyVal = t("profile.empty_value", "—");

  const editableFields: { key: keyof ProfileForm; id: string; label: string; icon: React.ReactNode; type?: "text" | "tel" | "textarea"; wide?: boolean }[] = [
    { key: "name", id: "profile-name", label: t("profile.field_name", "Full Name"), icon: <User size={12} /> },
    { key: "phone", id: "profile-phone", label: t("profile.field_phone", "Phone Number"), icon: <Phone size={12} />, type: "tel" },
    { key: "address", id: "profile-address", label: t("profile.field_address", "Location"), icon: <MapPin size={12} /> },
    { key: "bio", id: "profile-bio", label: t("profile.field_bio", "Bio"), icon: <Edit3 size={12} />, type: "textarea", wide: true },
  ];

  const renderField = (f: (typeof editableFields)[number]) => (
    <div key={f.key} className={`${f.wide ? "sm:col-span-2 " : ""}space-y-1.5`}>
      <label htmlFor={f.id} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7a6a58]">
        {f.icon} {f.label}
      </label>
      {isEditing ? (
        f.type === "textarea" ? (
          <textarea id={f.id} rows={3} value={formData[f.key]} onChange={(e) => setFormData((p) => ({ ...p, [f.key]: e.target.value }))} className={`${INPUT_CLS} resize-none`} />
        ) : (
          <input id={f.id} type={f.type || "text"} value={formData[f.key]} onChange={(e) => setFormData((p) => ({ ...p, [f.key]: e.target.value }))} className={INPUT_CLS} />
        )
      ) : (
        <p className={`${READONLY_CLS} ${f.wide ? "leading-relaxed" : ""}`}>{formData[f.key] || emptyVal}</p>
      )}
    </div>
  );

  return (
    <div className="profile-theme min-h-screen bg-[var(--cream)] pb-16 pt-24">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-[#f0e8d8] bg-white shadow-sm">
          <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-8">
            <div className="group relative flex-shrink-0">
              <div className="relative h-20 w-20 overflow-hidden rounded-full shadow-md ring-4 ring-[#f0e8d8] sm:h-24 sm:w-24">
                <AvatarImage key={avatarSrc} src={avatarSrc} alt={user.name || "Profile"} initials={userInitials} />
              </div>
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} aria-label={t("profile.aria_change_avatar", "Change profile picture")} title={t("profile.aria_change_avatar", "Change profile picture")} className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#e0a83c] text-[#1a1410] shadow-lg transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60">
                {avatarUploading ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#1a1410] border-t-transparent" /> : <Camera size={14} />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="font-serif text-xl font-bold tracking-tight text-[#1a1410] sm:text-2xl">{user.name || t("profile.default_name", "Dream More User")}</h1>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-[#7a6a58] sm:justify-start"><Mail size={14} />{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-[#b98a3e]">
                  <Star size={12} />{user.role === "ADMIN" ? t("profile.admin_role", "Administrator") : t("profile.member_role", "Member")}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#7a6a58]"><Calendar size={12} />{t("profile.since_label", "Since")} {memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        {toast && (
          <div role="status" className={`fixed right-4 top-20 z-50 flex items-center gap-3 rounded-xl border px-5 py-3 shadow-2xl sm:right-8 ${toast.kind === "success" ? "border-[#b98a3e] bg-[#2a1f18] text-[#e0a83c]" : "border-red-700 bg-red-600 text-white"}`}>
            {toast.kind === "success" ? <Check size={18} /> : <X size={18} />}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-[#f0e8d8] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f0e8d8] px-6 py-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#1a1410]">{t("profile.section_personal_title", "Personal Information")}</h2>
                  <p className="mt-0.5 text-xs text-[#7a6a58]">{t("profile.section_personal_sub", "Manage your personal details")}</p>
                </div>
                {!isEditing ? (
                  <button type="button" onClick={() => setIsEditing(true)} className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-semibold text-[#b98a3e] transition-all duration-200 hover:bg-yellow-100">
                    <Edit3 size={14} />{t("profile.action_edit", "Edit")}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setIsEditing(false); setFormData(toProfileForm(user)); }} disabled={saving} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-[#7a6a58] transition-all duration-200 hover:bg-gray-100 disabled:opacity-50">
                      <X size={14} />{t("profile.action_cancel", "Cancel")}
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-[#3a2a1e] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#3a2a1e]/20 transition-all duration-200 hover:bg-[#2a1f18] disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />{t("profile.action_saving", "Saving…")}</> : <><Check size={14} />{t("profile.action_save", "Save")}</>}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
                {editableFields.slice(0, 2).map(renderField)}
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7a6a58]"><Mail size={12} />{t("profile.field_email", "Email Address")}</span>
                  <p className={`${READONLY_CLS} flex items-center justify-between text-[#7a6a58]`}><span className="truncate">{user.email}</span><Shield size={14} className="ml-2 flex-shrink-0 text-[#b98a3e]" /></p>
                </div>
                {editableFields.slice(2).map(renderField)}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {rewards && rewards.rules.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-[#f0e8d8] bg-white shadow-sm">
                <div className="border-b border-[#f0e8d8] px-5 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#1a1410]"><Gift size={16} className="text-[#b98a3e]" />My Rewards</h3>
                  <p className="mt-0.5 text-[11px] text-[#7a6a58]">Total spend: {money(rewards.totalSpend)}</p>
                </div>
                <div className="max-h-96 space-y-3 overflow-y-auto p-3">
                  {rewards.rules.map((rule) => (
                    <div key={rule.id} className={`rounded-xl border p-3 ${rule.qualified ? "border-emerald-200 bg-emerald-50/60" : "border-[#f0e8d8] bg-[#faf6ee]/40"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#1a1410]">{rule.name}</p>
                        {rule.qualified && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Qualified</span>}
                      </div>
                      {rule.description && <p className="mt-0.5 text-[11px] text-[#7a6a58]">{rule.description}</p>}
                      <p className="mt-1 text-xs font-semibold text-[#b98a3e]">
                        {rewardLabel(rule.rewardType, rule.rewardValue)}
                        {rule.promoCode && <span className="ml-1 inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-[#8a6420]"><Ticket size={10} /> {rule.promoCode}</span>}
                      </p>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-[#7a6a58]">
                          <span>{rule.triggerType === "MIN_QUANTITY" ? `${rule.progress} / ${rule.threshold} items` : `${money(rule.progress)} / ${money(rule.threshold)}`}</span>
                          <span>{rule.percent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f0e8d8]">
                          <div className={`h-full rounded-full transition-all ${rule.qualified ? "bg-emerald-500" : "bg-[#e0a83c]"}`} style={{ width: `${rule.percent}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {rewards.qualifiedOrders.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Qualified orders</p>
                      <div className="mt-2 space-y-1.5">
                        {rewards.qualifiedOrders.slice(0, 5).map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-xs"><span className="font-semibold text-[#1a1410]">{o.orderNumber}</span><span className="text-[#7a6a58]">{o.rule.name}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {rewards.dispatches.length > 0 && (
                    <div className="rounded-xl border border-[#f0e8d8] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#7a6a58]">Reward notifications</p>
                      <div className="mt-2 space-y-1.5">
                        {rewards.dispatches.slice(0, 5).map((d) => (
                          <div key={d.id} className="flex items-center justify-between text-xs">
                            <span className="text-[#1a1410]">{d.rewardRule?.name || "Reward"}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${d.status === "SENT" || d.status === "REDEEMED" ? "bg-emerald-100 text-emerald-700" : d.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{d.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-[#f0e8d8] bg-white shadow-sm">
              <div className="border-b border-[#f0e8d8] px-5 py-4">
                <h3 className="text-sm font-bold text-[#1a1410]">{t("profile.section_account_title", "Account & Security")}</h3>
              </div>
              <div className="p-2">
                <Link href="/settings" className="group flex items-center gap-3.5 rounded-xl px-3 py-3 transition-all duration-200 hover:bg-[#faf6ee]/60">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-50 text-[#b98a3e] transition-transform duration-200 group-hover:scale-110"><Shield size={18} /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1a1410]">{t("profile.account_security_title", "Security Settings")}</p>
                    <p className="text-[11px] text-[#7a6a58]">{t("profile.account_security_desc", "Password & 2FA")}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#7a6a58]/40 transition-colors group-hover:text-[#b98a3e]" />
                </Link>
                <button type="button" onClick={handleLogout} disabled={loggingOut} className="group flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-transform duration-200 group-hover:scale-110">
                    {loggingOut ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" /> : <LogOut size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-600">{loggingOut ? t("profile.account_signing_out", "Signing out…") : t("profile.account_signout_title", "Sign Out")}</p>
                    <p className="text-[11px] text-red-400">{t("profile.account_signout_desc", "Log out of your account")}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}