// app/profile/page.tsx
"use client";

import React, {
  useState,
  useRef,
  ChangeEvent,
  useEffect,
  useMemo,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Edit3,
  Check,
  X,
  ChevronRight,
  Shield,
  Camera,
  LogOut,
  Star,
  Gift,
  Ticket,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/api";

// ─── Avatar resolver — Cloudinary-only ────────────────────────────────────
function resolveAvatar(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s) return "";

  if (s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  return "";
}

// ─── Member since — derived from user.createdAt if available ───────────────
function formatMemberSince(createdAt?: string | null): string {
  if (!createdAt) return "—";
  try {
    return new Date(createdAt).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface RewardRuleProgress {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  triggerType: string;
  threshold: number;
  rewardType: string;
  rewardValue: string;
  promoCode: string | null;
  expiresAt: string | null;
  product: { id: string; name: string } | null;
  progress: number;
  percent: number;
  qualified: boolean;
}

interface QualifiedOrder {
  id: string;
  orderNumber: string;
  total: number;
  createdAt: string;
  rule: { id: string; name: string; rewardType: string; rewardValue: string; promoCode: string | null };
}

interface RewardDispatch {
  id: string;
  channel: string;
  status: string;
  message: string | null;
  sentAt: string | null;
  createdAt: string;
  rewardRule: { id: string; name: string; rewardValue: string } | null;
}

interface MyRewards {
  totalSpend: number;
  rules: RewardRuleProgress[];
  qualifiedOrders: QualifiedOrder[];
  dispatches: RewardDispatch[];
}

const rewardLabel = (type: string, value: string) => {
  switch (type) {
    case "PERCENT_DISCOUNT":
      return `${value}% discount`;
    case "FIXED_CASHBACK":
      return `${value} ETB cashback`;
    case "FREE_ITEM":
      return `Free: ${value}`;
    case "MOBILE_AIRTIME":
      return `${value} ETB airtime`;
    default:
      return value || "Reward";
  }
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);

// ─── Avatar with fallback ───────────────────────────────────────────────────
const AvatarImage: React.FC<{
  src: string;
  alt: string;
  initials: string;
}> = ({ src, alt, initials }) => {
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
      <div className="w-full h-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center">
        <span className="text-2xl font-bold text-white font-serif">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      className="object-cover"
      sizes="80px"
      priority
      onError={() => setFailed(true)}
      unoptimized
    />
  );
};

export default function ProfilePage() {
  const { user, status, logout, updateProfile, uploadAvatar } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const derivedFormData = useMemo(
    () => ({
      name: user?.name || "",
      phone: user?.phone || "",
      address: user?.address || "",
      bio: user?.bio || "",
    }),
    [user]
  );

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(derivedFormData);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [rewards, setRewards] = useState<MyRewards | null>(null);

  // Sync form data when user changes
  const [prevUserId, setPrevUserId] = useState(user?.id);
  if (user?.id !== prevUserId) {
    setPrevUserId(user?.id);
    setFormData({
      name: user?.name || "",
      phone: user?.phone || "",
      address: user?.address || "",
      bio: user?.bio || "",
    });
  }

  useEffect(() => {
    if (status === "unauthenticated" && !loggingOut) {
      router.replace("/");
    }
  }, [status, router, loggingOut]);

  useEffect(() => {
    if (status !== "authenticated" || !user) return;
    let cancelled = false;
    api
      .get("/api/rewards/me")
      .then((res) => {
        if (!cancelled && res.data?.success) setRewards(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      router.replace("/");
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError(
        t("profile.error_image_size", "Image must be smaller than 5 MB")
      );
      setTimeout(() => setSaveError(null), 4000);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSaveError(
        t("profile.error_image_type", "Please choose an image file")
      );
      setTimeout(() => setSaveError(null), 4000);
      return;
    }

    const preview = URL.createObjectURL(file);
    setAvatarUrl(preview);

    setAvatarUploading(true);
    setSaveError(null);

    try {
      await uploadAvatar(file);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("profile.error_avatar_upload", "Failed to upload avatar");
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 4000);
      setAvatarUrl(null);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        bio: formData.bio,
      });

      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("profile.error_profile_save", "Failed to save profile");
      setSaveError(msg);
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        address: user.address || "",
        bio: user.bio || "",
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="profile-theme min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3a2a1e] border-t-[#e0a83c] rounded-full animate-spin" />
          <p className="text-[#7a6a58] font-sans text-sm">
            {t("profile.loading", "Loading your profile...")}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userInitials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  const resolvedAvatar = avatarUrl ? avatarUrl : resolveAvatar(user.avatar);
  const memberSince = formatMemberSince(
    (user as { createdAt?: string }).createdAt
  );

  return (
    <div className="profile-theme min-h-screen bg-[var(--cream)] pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* PROFILE CARD */}
        <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
              {/* Avatar */}
              <div className="relative group flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-4 ring-[#f0e8d8] shadow-md relative">
                  <AvatarImage
                    src={resolvedAvatar}
                    alt={user.name || "Profile"}
                    initials={userInitials}
                  />
                </div>

                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#e0a83c] text-[#1a1410] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-200 border-2 border-white disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label={t(
                    "profile.aria_change_avatar",
                    "Change profile picture"
                  )}
                  title={t(
                    "profile.aria_change_avatar",
                    "Change profile picture"
                  )}
                >
                  {avatarUploading ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#1a1410] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  title={t(
                    "profile.aria_change_avatar",
                    "Change profile picture"
                  )}
                />
              </div>

              {/* User info */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-[#1a1410] font-serif tracking-tight">
                  {user.name || t("profile.default_name", "Dream More User")}
                </h1>
                <p className="text-[#7a6a58] text-sm mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                  <Mail size={14} />
                  {user.email}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-[#b98a3e] border border-yellow-200">
                    <Star size={12} />
                    {user.role === "ADMIN"
                      ? t("profile.admin_role", "Administrator")
                      : t("profile.member_role", "Member")}
                  </span>
                  <span className="text-[#7a6a58] text-xs flex items-center gap-1">
                    <Calendar size={12} />
                    {t("profile.since_label", "Since")} {memberSince}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TOASTS */}
        {saveSuccess && (
          <div className="fixed top-20 right-4 sm:right-8 z-50 flex items-center gap-3 px-5 py-3 bg-[#2a1f18] text-[#e0a83c] rounded-xl shadow-2xl border border-[#b98a3e]">
            <Check size={18} />
            <span className="text-sm font-semibold">
              {t("profile.toast_saved", "Profile updated successfully!")}
            </span>
          </div>
        )}

        {saveError && (
          <div className="fixed top-20 right-4 sm:right-8 z-50 flex items-center gap-3 px-5 py-3 bg-red-600 text-white rounded-xl shadow-2xl border border-red-700">
            <X size={18} />
            <span className="text-sm font-semibold">{saveError}</span>
          </div>
        )}

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN — Personal Information */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0e8d8]">
                <div>
                  <h2 className="text-lg font-bold text-[#1a1410] font-serif">
                    {t(
                      "profile.section_personal_title",
                      "Personal Information"
                    )}
                  </h2>
                  <p className="text-xs text-[#7a6a58] mt-0.5">
                    {t(
                      "profile.section_personal_sub",
                      "Manage your personal details"
                    )}
                  </p>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#b98a3e] bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 transition-all duration-200"
                  >
                    <Edit3 size={14} />
                    {t("profile.action_edit", "Edit")}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-[#7a6a58] bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all duration-200 disabled:opacity-50"
                    >
                      <X size={14} />
                      {t("profile.action_cancel", "Cancel")}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#3a2a1e] hover:bg-[#2a1f18] shadow-md shadow-[#3a2a1e]/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {t("profile.action_saving", "Saving…")}
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          {t("profile.action_save", "Save")}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-name"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#7a6a58] uppercase tracking-wider"
                    >
                      <User size={12} />
                      {t("profile.field_name", "Full Name")}
                    </label>
                    {isEditing ? (
                      <input
                        id="profile-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[#f0e8d8] bg-[#faf6ee]/50 text-[#1a1410] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#e0a83c]/30 focus:border-[#e0a83c] transition-all"
                      />
                    ) : (
                      <p className="px-4 py-2.5 rounded-xl bg-[#faf6ee]/40 text-[#1a1410] text-sm font-medium">
                        {formData.name || t("profile.empty_value", "—")}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-[#7a6a58] uppercase tracking-wider">
                      <Mail size={12} />
                      {t("profile.field_email", "Email Address")}
                    </label>
                    <p className="px-4 py-2.5 rounded-xl bg-[#faf6ee]/40 text-[#7a6a58] text-sm font-medium flex items-center justify-between">
                      <span className="truncate">{user.email}</span>
                      <Shield
                        size={14}
                        className="text-[#b98a3e] flex-shrink-0 ml-2"
                      />
                    </p>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-phone"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#7a6a58] uppercase tracking-wider"
                    >
                      <Phone size={12} />
                      {t("profile.field_phone", "Phone Number")}
                    </label>
                    {isEditing ? (
                      <input
                        id="profile-phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[#f0e8d8] bg-[#faf6ee]/50 text-[#1a1410] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#e0a83c]/30 focus:border-[#e0a83c] transition-all"
                      />
                    ) : (
                      <p className="px-4 py-2.5 rounded-xl bg-[#faf6ee]/40 text-[#1a1410] text-sm font-medium">
                        {formData.phone || t("profile.empty_value", "—")}
                      </p>
                    )}
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-address"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#7a6a58] uppercase tracking-wider"
                    >
                      <MapPin size={12} />
                      {t("profile.field_address", "Location")}
                    </label>
                    {isEditing ? (
                      <input
                        id="profile-address"
                        type="text"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            address: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[#f0e8d8] bg-[#faf6ee]/50 text-[#1a1410] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#e0a83c]/30 focus:border-[#e0a83c] transition-all"
                      />
                    ) : (
                      <p className="px-4 py-2.5 rounded-xl bg-[#faf6ee]/40 text-[#1a1410] text-sm font-medium">
                        {formData.address || t("profile.empty_value", "—")}
                      </p>
                    )}
                  </div>

                  {/* Bio */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label
                      htmlFor="profile-bio"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#7a6a58] uppercase tracking-wider"
                    >
                      <Edit3 size={12} />
                      {t("profile.field_bio", "Bio")}
                    </label>
                    {isEditing ? (
                      <textarea
                        id="profile-bio"
                        rows={3}
                        value={formData.bio}
                        onChange={(e) =>
                          setFormData({ ...formData, bio: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-[#f0e8d8] bg-[#faf6ee]/50 text-[#1a1410] text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-[#e0a83c]/30 focus:border-[#e0a83c] transition-all"
                      />
                    ) : (
                      <p className="px-4 py-2.5 rounded-xl bg-[#faf6ee]/40 text-[#1a1410] text-sm font-medium leading-relaxed">
                        {formData.bio || t("profile.empty_value", "—")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Rewards & Account */}
          <div className="space-y-6">
            {/* My Rewards */}
            {rewards && rewards.rules.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#f0e8d8]">
                  <h3 className="text-sm font-bold text-[#1a1410] flex items-center gap-2">
                    <Gift size={16} className="text-[#b98a3e]" />
                    My Rewards
                  </h3>
                  <p className="text-[11px] text-[#7a6a58] mt-0.5">
                    Total spend: {money(rewards.totalSpend)}
                  </p>
                </div>
                <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
                  {rewards.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`rounded-xl border p-3 ${
                        rule.qualified
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-[#f0e8d8] bg-[#faf6ee]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#1a1410]">
                          {rule.name}
                        </p>
                        {rule.qualified && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            Qualified
                          </span>
                        )}
                      </div>
                      {rule.description && (
                        <p className="mt-0.5 text-[11px] text-[#7a6a58]">
                          {rule.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs font-semibold text-[#b98a3e]">
                        {rewardLabel(rule.rewardType, rule.rewardValue)}
                        {rule.promoCode && (
                          <span className="ml-1 inline-flex items-center gap-1 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-[#8a6420]">
                            <Ticket size={10} /> {rule.promoCode}
                          </span>
                        )}
                      </p>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-[#7a6a58]">
                          <span>
                            {rule.triggerType === "MIN_QUANTITY"
                              ? `${rule.progress} / ${rule.threshold} items`
                              : `${money(rule.progress)} / ${money(rule.threshold)}`}
                          </span>
                          <span>{rule.percent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f0e8d8]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              rule.qualified ? "bg-emerald-500" : "bg-[#e0a83c]"
                            }`}
                            style={{ width: `${rule.percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {rewards.qualifiedOrders.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                        Qualified orders
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {rewards.qualifiedOrders.slice(0, 5).map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-[#1a1410]">
                              {o.orderNumber}
                            </span>
                            <span className="text-[#7a6a58]">
                              {o.rule.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rewards.dispatches.length > 0 && (
                    <div className="rounded-xl border border-[#f0e8d8] p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#7a6a58]">
                        Reward notifications
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {rewards.dispatches.slice(0, 5).map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-[#1a1410]">
                              {d.rewardRule?.name || "Reward"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                d.status === "SENT" || d.status === "REDEEMED"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : d.status === "FAILED"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#f0e8d8]">
                <h3 className="text-sm font-bold text-[#1a1410]">
                  {t(
                    "profile.section_account_title",
                    "Account & Security"
                  )}
                </h3>
              </div>
              <div className="p-2">
                <Link
                  href="/settings"
                  className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-[#faf6ee]/60 transition-all duration-200 group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#b98a3e] bg-yellow-50 group-hover:scale-110 transition-transform duration-200">
                    <Shield size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1a1410]">
                      {t(
                        "profile.account_security_title",
                        "Security Settings"
                      )}
                    </p>
                    <p className="text-[11px] text-[#7a6a58]">
                      {t("profile.account_security_desc", "Password & 2FA")}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-[#7a6a58]/40 group-hover:text-[#b98a3e] transition-colors"
                  />
                </Link>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-50 transition-all duration-200 group w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-red-500 bg-red-50 group-hover:scale-110 transition-transform duration-200">
                    {loggingOut ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <LogOut size={18} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-600">
                      {loggingOut
                        ? t("profile.account_signing_out", "Signing out…")
                        : t("profile.account_signout_title", "Sign Out")}
                    </p>
                    <p className="text-[11px] text-red-400">
                      {t(
                        "profile.account_signout_desc",
                        "Log out of your account"
                      )}
                    </p>
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