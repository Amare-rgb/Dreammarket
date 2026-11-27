"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { useLanguage } from "@/context/LanguageContext";

export default function UserSettingsPage() {
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const { t } = useLanguage();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#faf6ee] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#3a2a1e] border-t-[#e0a83c] rounded-full animate-spin" />
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

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf6ee] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-[#7a6a58] hover:text-[#1a1410] transition-colors"
        >
          <ArrowLeft size={14} />{" "}
          {t("settings.back_to_profile", "Back to profile")}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-white text-lg font-bold shadow-md">
              {userInitials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#1a1410] font-serif">
                {t("settings.page_title", "Settings")}
              </h1>
              <p className="text-xs text-[#7a6a58] truncate">
                {user.name} · {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Account section */}
        <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0e8d8]">
            <h2 className="text-sm font-bold text-[#1a1410] flex items-center gap-2">
              <User size={16} className="text-[#b98a3e]" />{" "}
              {t("settings.section_account", "Account")}
            </h2>
          </div>
          <div className="p-2">
            <Link
              href="/profile"
              className="flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-[#faf6ee]/60 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#b98a3e] bg-yellow-50 group-hover:scale-110 transition-transform">
                <User size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1a1410]">
                  {t(
                    "settings.account_personal_title",
                    "Personal Information"
                  )}
                </p>
                <p className="text-[11px] text-[#7a6a58]">
                  {t(
                    "settings.account_personal_desc",
                    "Name, phone, address, bio"
                  )}
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white rounded-2xl border border-[#f0e8d8] shadow-sm overflow-hidden">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 px-5 py-4 hover:bg-red-50 transition-colors w-full text-left group"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-red-500 bg-red-50 group-hover:scale-110 transition-transform">
              <LogOut size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-600">
                {t("settings.signout_title", "Sign Out")}
              </p>
              <p className="text-[11px] text-red-400">
                {t("settings.signout_desc", "Log out of your account")}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}