// app/admin/layout.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  Bell,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Settings,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

// ============================================================
// Types
// ============================================================
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar?: string;
}

interface NavItem {
  name: string;
  href: string;
  section: string;
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

// ============================================================
// Logo resolver — Cloudinary ONLY
// ============================================================
function resolveLogo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  return null;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { settings } = useSettings();
  const pathname = usePathname();
  const router = useRouter();

  const isMountedRef = useRef<boolean>(false);
  const isAuthCheckedRef = useRef<boolean>(false);
  const redirectingRef = useRef<boolean>(false);

  // Set mounted state once
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      setIsMounted(true);
    }
  }, []);

  // Check authentication once
  useEffect(() => {
    if (isAuthCheckedRef.current || !isMounted || redirectingRef.current) {
      return;
    }

    const checkAuth = (): void => {
      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");
      const userData =
        localStorage.getItem("user") || sessionStorage.getItem("user");

      if (!token) {
        redirectingRef.current = true;
        router.replace("/auth/signin");
        setLoading(false);
        return;
      }

      if (userData) {
        try {
          const parsedUser: User = JSON.parse(userData);

          if (parsedUser.role?.toUpperCase() !== "ADMIN") {
            redirectingRef.current = true;
            router.replace("/");
            setLoading(false);
            return;
          }

          setUser(parsedUser);
          isAuthCheckedRef.current = true;
          setLoading(false);
        } catch (error) {
          console.error("Error parsing user data:", error);
          redirectingRef.current = true;
          router.replace("/auth/signin");
          setLoading(false);
        }
      } else {
        redirectingRef.current = true;
        router.replace("/auth/signin");
        setLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".notification-menu")) setNotificationsOpen(false);
      if (!target.closest(".profile-menu")) setProfileOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Navigation (Icons removed as requested)
  const navItems: NavItem[] = [
    { name: "Dashboard", href: "/admin/dashboard", section: "Main" },
    { name: "Products", href: "/admin/products", section: "Main" },
    { name: "Orders", href: "/admin/orders", section: "Main" },
    { name: "Articles", href: "/admin/articles", section: "Main" },
    { name: "Comments", href: "/admin/comments", section: "Main" },
    { name: "Users", href: "/admin/users", section: "Main" },
    { name: "Settings", href: "/admin/settings", section: "Settings" },
  ];

  // Mock notifications
  const notifications: NotificationItem[] = [
    {
      id: 1,
      title: "New Product Added",
      message: "A new plastic product has been listed",
      time: "5 min ago",
      read: false,
    },
    {
      id: 2,
      title: "Low Stock Alert",
      message: "Heavy-Duty Storage Bin is running low",
      time: "1 hour ago",
      read: false,
    },
    {
      id: 3,
      title: "New User Registered",
      message: "A new customer joined",
      time: "3 hours ago",
      read: true,
    },
    {
      id: 4,
      title: "Profile Updated",
      message: "Your profile was updated successfully",
      time: "5 hours ago",
      read: true,
    },
  ];

  const unreadCount: number = notifications.filter((n) => !n.read).length;

  // Safe user data
  const adminUser: User = {
    id: user?.id ?? "",
    name: user?.name ?? "Admin User",
    email: user?.email ?? "admin@alemayehplastic.com",
    role: user?.role ?? "ADMIN",
  };

  const handleLogout = (): void => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userRole");
    isAuthCheckedRef.current = false;
    router.push("/auth/signin");
  };

  // Group nav items by section
  const groupedNavItems = navItems.reduce<Record<string, NavItem[]>>(
    (acc, item) => {
      const section = item.section || "Main";
      if (!acc[section]) acc[section] = [];
      acc[section].push(item);
      return acc;
    },
    {}
  );

  const sectionLabels: Record<string, string> = {
    Main: "Main Menu",
    Settings: "Settings",
  };

  const getPageTitle = (): string => {
    if (!pathname) return "Dashboard";
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1];
    if (!lastSegment || lastSegment === "admin") return "Dashboard";
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  // ── Loading state ────────────────────────────────────────
  if (loading || !isMounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB6D3D] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role?.toUpperCase() !== "ADMIN") {
    return null;
  }

  // ── Logo resolution ──────────────────────────────────────
  const logoUrl = resolveLogo(settings?.logo) || "/banners/photo.jpg";
  const siteName = settings?.siteName || "Dream More Affiliate Market";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-3 border-b border-[#cf5427] bg-[#EB6D3D] shrink-0">
          <Link
            href="/admin/dashboard"
            className="flex min-w-0 items-center space-x-2"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 relative bg-white flex items-center justify-center">
              <Image
                src={logoUrl}
                alt={siteName}
                width={36}
                height={36}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
            {sidebarOpen && (
              <span className="text-sm font-semibold text-white whitespace-nowrap truncate">
                {siteName}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="admin-sidebar"
          >
            {sidebarOpen ? (
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4 overflow-y-auto flex-1">
          {Object.keys(groupedNavItems).map((section) => (
            <div key={section}>
              {sidebarOpen && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {sectionLabels[section] ?? section}
                </p>
              )}
              <div className="space-y-1">
                {groupedNavItems[section]?.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + "/") ||
                    false;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={!sidebarOpen ? item.name : undefined}
                      className={`flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-[#EB6D3D]/15 text-[#9c3d1a] font-semibold"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      } ${!sidebarOpen ? "justify-center" : ""}`}
                    >
                      <span
                        className={`text-sm ${
                          !sidebarOpen ? "text-xs font-bold" : ""
                        }`}
                      >
                        {sidebarOpen
                          ? item.name
                          : item.name.charAt(0).toUpperCase()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="border-t border-gray-200 my-4"></div>

          {/* Return to Store */}
          <Link
            href="/"
            className={`flex items-center px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 ${
              sidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <span className="text-sm font-medium">
              {sidebarOpen ? "Return to Store" : "🏪"}
            </span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`flex items-center px-3 py-2.5 w-full rounded-lg text-red-700 hover:bg-red-50 transition-all duration-200 mt-2 ${
              sidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <span
              className={`text-sm font-medium ${!sidebarOpen ? "sr-only" : ""}`}
            >
              Logout
            </span>
            {!sidebarOpen && <LogOut className="w-5 h-5 flex-shrink-0" />}
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-gray-800 hidden md:block">
                {getPageTitle()}
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="hidden md:block relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search in admin..."
                  className="w-64 pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EB6D3D]/40 focus:border-[#EB6D3D] transition-all"
                />
              </div>

              {/* Notifications */}
              <div className="relative notification-menu">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-xs font-medium text-white bg-red-500 rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-800">
                        Notifications
                      </h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                            !notif.read ? "bg-yellow-50" : ""
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-800">
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {notif.time}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 border-t border-gray-200">
                      <button className="w-full text-center text-sm text-[#cf5427] hover:text-[#9c3d1a] font-medium py-1">
                        View All Notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative profile-menu">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center space-x-3 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Profile"
                >
                  <div className="w-8 h-8 rounded-full bg-[#EB6D3D] flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {adminUser.name?.charAt(0) || "A"}
                    </span>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-gray-800">
                      {adminUser.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {adminUser.role?.toLowerCase()}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-800">
                        {adminUser.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {adminUser.email}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[#EB6D3D]/15 text-[#9c3d1a] capitalize">
                        {adminUser.role?.toLowerCase()}
                      </span>
                    </div>
                    <Link
                      href="/admin/profile"
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">My Profile</span>
                    </Link>
                    <Link
                      href="/admin/settings"
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Settings</span>
                    </Link>
                    <div className="border-t border-gray-200"></div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 px-4 py-2 w-full hover:bg-gray-50 transition-colors text-red-600"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}