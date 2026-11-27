// components/layout/Navbar.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sun,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { readCart } from "@/app/lib/cart";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  parentId?: string | null;
  children?: Category[];
  _count?: { products?: number };
}

interface StoredUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const BRAND_TOP = "Dream More";
const BRAND_BOTTOM = "Affiliate Market";
const BRAND_ALT = "Dream More Affiliate Market";
const ETHIOPIC_FONT = "'Noto Sans Ethiopic','Nyala','Abyssinica SIL','Kefa','Ebrima',sans-serif";
const HOME_PATHS = new Set(["/", "/about", "/shop", "/contact"]);

const FALLBACK_CATEGORIES: Category[] = [
  { id: "fb-containers", name: "Containers & Storage", slug: "containers", description: "Durable storage boxes, crates & bins", icon: "📦" },
  { id: "fb-household", name: "Household Plastic", slug: "household", description: "Buckets, basins, jugs & daily-use items", icon: "🪣" },
  { id: "fb-industrial", name: "Industrial Parts", slug: "industrial", description: "Heavy-duty plastic components & fittings", icon: "⚙️" },
  { id: "fb-packaging", name: "Packaging", slug: "packaging", description: "Bottles, caps, seals & custom packaging", icon: "🧴" },
  { id: "fb-pipes", name: "Pipes & Fittings", slug: "pipes", description: "PVC pipes, connectors & plumbing parts", icon: "🔧" },
  { id: "fb-custom", name: "Custom Manufacturing", slug: "custom", description: "Bespoke plastic products for your business", icon: "✦" },
];

function resolveCloudinaryUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("res.cloudinary.com/") ? `https://${s}` : null;
}

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

function subscribeStoredUser(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("auth-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("auth-change", cb);
  };
}

function useScrolled(threshold = 60) {
  return useSyncExternalStore(subscribeScroll, () => window.scrollY > threshold, () => false);
}

function useStoredUser(): StoredUser | null {
  const raw = useSyncExternalStore(
    subscribeStoredUser,
    () => {
      try {
        return localStorage.getItem("user");
      } catch {
        return null;
      }
    },
    () => null
  );
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  }, [raw]);
}

function AvatarBubble({ src, name, size }: { src?: string | null; name?: string | null; size: number }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveCloudinaryUrl(src);
  const initial = name ? name.charAt(0).toUpperCase() : null;

  return (
    <div
      className="relative flex items-center justify-center overflow-hidden rounded-full bg-[#e0a83c] font-bold text-[#1a1410] shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {resolved && !failed ? (
        <Image src={resolved} alt={name || "User"} width={size} height={size} className="h-full w-full object-cover" onError={() => setFailed(true)} unoptimized />
      ) : initial ? (
        initial
      ) : (
        <User style={{ width: size * 0.55, height: size * 0.55 }} />
      )}
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={`flex items-center gap-2 rounded-full border-2 border-[#d9b36a] bg-white py-1 pl-3.5 pr-1 shadow-[0_0_0_4px_rgba(224,168,60,0.16),0_6px_18px_rgba(0,0,0,0.12)] transition-shadow duration-200 focus-within:shadow-[0_0_0_4px_rgba(224,168,60,0.34),0_6px_18px_rgba(0,0,0,0.16)] ${className}`}
    >
      <Search size={16} className="shrink-0 text-[#7b8aa8]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="h-8 min-w-0 flex-1 bg-transparent text-[12px] text-[#1a1410] outline-none placeholder:text-[#8d97ab]"
      />
      <button type="submit" aria-label="Search" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16233f] text-[#f0c872] transition-colors hover:bg-[#1f3159]">
        <Sparkles size={14} />
      </button>
    </form>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user, status, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const scrolled = useScrolled(60);
  const localUser = useStoredUser();

  const isAdminRoute = pathname?.startsWith("/admin") || false;
  const isArticlesRoute = pathname?.startsWith("/articles") || false;
  const isHome = HOME_PATHS.has(pathname || "");

  const activeUser = status === "authenticated" && user ? user : localUser;
  const userRole = (activeUser?.role || "USER").toUpperCase();
  const isAdmin = userRole === "ADMIN";
  const isAuthenticated = status === "authenticated" || (status !== "unauthenticated" && !!activeUser);

  useEffect(() => {
    const syncCart = () => setCartCount(readCart().reduce((sum, item) => sum + item.quantity, 0));
    syncCart();
    window.addEventListener("cart-change", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("cart-change", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/categories`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : data?.data || [];
        setCategories(list.length ? list : FALLBACK_CATEGORIES);
      })
      .catch(() => active && setCategories(FALLBACK_CATEGORIES));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) setDropdownOpen(false);
      if (productsRef.current && !productsRef.current.contains(target)) setProductsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const closeAllMenus = () => {
    setMenuOpen(false);
    setMobileProductsOpen(false);
    setDropdownOpen(false);
    setProductsOpen(false);
    setSearchOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      closeAllMenus();
      router.push("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    closeAllMenus();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
  };

  if (isAdminRoute || isArticlesRoute) return null;

  const topCategories = categories.filter((c) => !c.parentId);
  const displayCategories = topCategories.length ? topCategories : categories.length ? categories : FALLBACK_CATEGORIES;
  const navLinks = [
    { label: t("nav.articles", "Articles"), href: "/articles" },
    { label: t("nav.about", "About Us"), href: "/about" },
    { label: t("nav.contact", "Contact"), href: "/contact" },
  ];
  const searchPlaceholder = t("nav.search_placeholder", "Search products, brands, categories…");

  const solid = !isHome || scrolled || menuOpen;
  const headerClass = isHome
    ? `fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "border-b border-black/10 bg-gradient-to-r from-[#e4e1dc] via-[#f4f2ee] to-[#e4e1dc] shadow-[0_8px_30px_rgba(0,0,0,.10)] backdrop-blur-md"
          : "border-b border-transparent bg-gradient-to-b from-black/60 via-black/25 to-transparent"
      }`
    : "relative z-50 w-full border-b border-black/10 bg-gradient-to-r from-[#e4e1dc] via-[#f4f2ee] to-[#e4e1dc] shadow-sm";

  const navLinkClass = `group relative whitespace-nowrap py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
    solid ? "text-[#1a1410]/70 hover:text-[#1a1410]" : "text-white/80 hover:text-white"
  }`;
  const iconBtnClass = `flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors duration-300 ${
    solid ? "border-[#d9d3c8] bg-white/70 text-[#1a1410] hover:bg-white" : "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
  }`;
  const pillBtnClass = `flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[11px] font-medium shadow-sm transition-colors duration-300 ${
    solid ? "border-[#d9d3c8] bg-white text-[#1a1410] hover:border-[#e0a83c]/50 hover:bg-[#faf6ef]" : "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
  }`;
  const itemCls = "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-medium text-[#1a1410]/80 hover:bg-[#faf6ef] hover:text-[#1a1410] group";
  const itemIconCls = "flex h-6 w-6 items-center justify-center rounded-lg border border-[#dfe3eb] bg-[#f7f8fa] text-[#30384f]/70 transition-colors group-hover:bg-[#EB6D3D] group-hover:text-white";

  return (
    <header className={headerClass}>
      <div className={`mx-auto flex w-[min(1180px,calc(100%-48px))] items-center justify-between gap-4 transition-all duration-300 xl:gap-6 ${isHome && !scrolled ? "h-[80px]" : "h-[68px]"}`}>
        <Link href="/" onClick={closeAllMenus} aria-label={BRAND_ALT} className="group flex shrink-0 items-center gap-2.5">
          <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm transition-colors duration-300 ${solid ? "border-[#EB6D3D]/50 bg-white" : "border-[#EB6D3D]/60 bg-white/90"}`}>
            {!logoFailed ? (
              <Image src="/banners/photo.jpg" alt={BRAND_ALT} width={48} height={48} className="h-full w-full object-contain" onError={() => setLogoFailed(true)} priority />
            ) : (
              <Building2 className="h-5 w-5 text-[#F47822]" />
            )}
          </div>
          <span className="flex flex-col whitespace-nowrap leading-none">
            <span className={`font-serif-heading text-[15px] font-bold tracking-[-0.01em] transition-colors duration-300 ${solid ? "text-[#20283a]" : "text-white"}`}>{BRAND_TOP}</span>
            <span className={`mt-1 text-[8px] font-semibold uppercase tracking-[0.22em] transition-colors duration-300 ${solid ? "text-[#d85d32]" : "text-[#ff9a68]"}`}>{BRAND_BOTTOM}</span>
          </span>
        </Link>

        <nav className="hidden shrink-0 items-center gap-4 lg:flex xl:gap-6">
          <Link href="/" className={navLinkClass}>
            {t("nav.home", "Home")}
            <span className={`absolute -bottom-[1px] left-0 h-[2px] bg-[#e0a83c] transition-all duration-300 ${pathname === "/" ? "w-3" : "w-0 group-hover:w-3"}`} />
          </Link>

          <div
            ref={productsRef}
            className="relative"
            onMouseEnter={() => {
              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
              setProductsOpen(true);
            }}
            onMouseLeave={() => {
              hoverTimerRef.current = setTimeout(() => setProductsOpen(false), 150);
            }}
          >
            <Link href="/shop" className={`${navLinkClass} flex items-center gap-1`}>
              <span>{t("nav.products", "Products")}</span>
              <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${productsOpen ? "rotate-180 text-[#e0a83c]" : solid ? "text-[#1a1410]/50" : "text-white/70"}`} />
              <span className={`absolute -bottom-[1px] left-0 h-[2px] bg-[#e0a83c] transition-all duration-150 ${pathname === "/shop" || productsOpen ? "w-3" : "w-0 group-hover:w-3"}`} />
            </Link>

            <div className={`absolute -left-6 top-full z-50 mt-2 w-[580px] max-w-[calc(100vw-2.5rem)] origin-top-left rounded-[24px] border border-[#eadfce] bg-white p-4 shadow-[0_30px_80px_rgba(0,0,0,0.25)] transition-all duration-100 ease-out sm:-left-12 sm:w-[640px] lg:-left-20 xl:left-0 ${productsOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-3 scale-95 opacity-0"}`}>
              <div className="flex items-center justify-between border-b border-[#eadfce] pb-2.5">
                <h4 className="text-xs font-semibold tracking-wide text-[#1a1410]">{t("nav.categories", "Categories")}</h4>
                <Link href="/shop" onClick={closeAllMenus} className="flex items-center gap-1.5 rounded-full border border-[#EB6D3D]/40 bg-[#faf6ef] px-2.5 py-1 text-[10px] font-semibold text-[#cf5427] transition-colors hover:bg-[#EB6D3D] hover:text-[#20283a]">
                  <span>{t("nav.shop", "Shop")}</span> <ArrowUpRight size={12} />
                </Link>
              </div>
              <div className="grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto pr-1 pt-2.5 md:grid-cols-3">
                {displayCategories.slice(0, 9).map((cat) => {
                  const img = resolveCloudinaryUrl(cat.image);
                  const count = cat._count?.products;
                  const subCount = cat.children?.length || 0;
                  return (
                    <Link key={cat.id} href={`/shop?category=${encodeURIComponent(cat.slug || cat.id)}`} onClick={closeAllMenus} className="group/cat flex items-start gap-2 rounded-xl border border-[#eadfce] bg-[#faf6ef] p-2 transition-all duration-200 hover:border-[#e0a83c]/60 hover:bg-[#f4ecde]">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eadfce] bg-white text-base transition-transform group-hover/cat:scale-105">
                        {img ? <Image src={img} alt={cat.name} width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <span>{cat.icon || "📦"}</span>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[10px] font-bold text-[#1a1410] transition-colors group-hover/cat:text-[#8a6212]">{cat.name}</span>
                          {count !== undefined && count > 0 && (
                            <span className="shrink-0 rounded-full bg-[#1a1410]/10 px-1.5 py-0.5 text-[8px] font-medium text-[#1a1410]/70">{count}</span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[9px] text-[#1a1410]/55">
                          {cat.description || (subCount > 0 ? `${subCount} ${t("nav.subcategories", "subcategories")}` : t("nav.quality_verified", "Quality assured"))}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-2.5 flex justify-end rounded-xl px-2 py-1">
                <Link href="/shop" onClick={closeAllMenus} className="text-[10px] font-bold uppercase tracking-wider text-[#8a6212] transition-colors hover:text-[#1a1410]">
                  {t("nav.view_all", "View All →")}
                </Link>
              </div>
            </div>
          </div>

          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
              <span className={`absolute -bottom-[1px] left-0 h-[2px] bg-[#e0a83c] transition-all duration-300 ${pathname === link.href ? "w-2" : "w-0 group-hover:w-2"}`} />
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2.5 lg:flex xl:gap-3">
          <Link
            href="/checkout"
            onClick={closeAllMenus}
            aria-label={`${t("nav.cart", "Cart")}, ${cartCount} ${t("nav.cart_items", "items")}`}
            className={`${pillBtnClass} relative px-3`}
          >
            <ShoppingCart size={15} />
            <span>{t("nav.cart", "Cart")}</span>
            <span className="flex min-w-5 items-center justify-center rounded-full bg-[#F47822] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          </Link>

          <button type="button" onClick={() => setSearchOpen((o) => !o)} aria-label={searchOpen ? "Close search" : "Open search"} aria-expanded={searchOpen} aria-controls="navbar-search-panel" className={iconBtnClass}>
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>

          <button type="button" onClick={toggleTheme} aria-label={t(theme === "dark" ? "nav.switch_to_light" : "nav.switch_to_dark", theme === "dark" ? "Switch to light mode" : "Switch to dark mode")} className={iconBtnClass}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <div className={`flex h-9 items-center rounded-full border p-0.5 shadow-sm transition-colors duration-300 ${solid ? "border-[#d9d3c8] bg-white/70" : "border-white/25 bg-white/10 backdrop-blur-md"}`}>
            <Globe size={12} className="ml-1.5 mr-1 shrink-0 text-[#e0a83c]" />
            {(["en", "am"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                style={lang === "am" ? { fontFamily: ETHIOPIC_FONT } : undefined}
                className={`flex h-7 min-w-[34px] items-center justify-center rounded-full px-2 font-bold transition-all duration-200 ${lang === "am" ? "text-[11px]" : "text-[10px]"} ${
                  language === lang ? "bg-[#EB6D3D] text-[#20283a] shadow-sm" : solid ? "text-[#1a1410]/60 hover:text-[#1a1410]" : "text-white/75 hover:text-white"
                }`}
              >
                {lang === "en" ? "EN" : "አማ"}
              </button>
            ))}
          </div>

          <div ref={dropdownRef} className="relative">
            {isAuthenticated ? (
              <>
                <button type="button" onClick={() => setDropdownOpen((p) => !p)} className={pillBtnClass}>
                  <AvatarBubble src={activeUser?.avatar} name={activeUser?.name} size={20} />
                  <span className="max-w-[80px] truncate">{activeUser?.name || t("nav.account", "Account")}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180 text-[#e0a83c]" : solid ? "text-[#1a1410]/60" : "text-white/70"}`} />
                </button>
                <div className={`absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-xl border border-[#eadfce] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-all duration-150 ease-out ${dropdownOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"}`}>
                  <div className="flex items-center gap-2 rounded-lg border border-[#eadfce] bg-[#faf6ef] p-2">
                    <AvatarBubble src={activeUser?.avatar} name={activeUser?.name} size={32} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-[10px] font-semibold text-[#1a1410]">{activeUser?.name || t("nav.my_account", "My Account")}</span>
                        <span className="shrink-0 rounded border border-[#e0a83c]/40 bg-[#e0a83c]/20 px-1 py-0.5 text-[7px] font-bold uppercase text-[#8a6212]">{userRole}</span>
                      </div>
                      <span className="truncate text-[9px] text-[#1a1410]/60">{activeUser?.email || ""}</span>
                    </div>
                  </div>
                  <div className="my-1 h-px bg-[#eadfce]" />
                  <Link href="/profile" onClick={closeAllMenus} className={itemCls}>
                    <span className={itemIconCls}><User className="h-3.5 w-3.5" /></span>
                    <span className="font-semibold text-[#1a1410]">{t("nav.profile", "Profile")}</span>
                  </Link>
                  <Link href="/orders" onClick={closeAllMenus} className={itemCls}>
                    <span className={itemIconCls}><ShoppingBag className="h-3.5 w-3.5" /></span>
                    <span className="font-semibold text-[#1a1410]">{t("nav.orders", "My Orders")}</span>
                  </Link>
                  {isAdmin && (
                    <Link href="/admin/dashboard" onClick={closeAllMenus} className={itemCls}>
                      <span className={itemIconCls}><LayoutDashboard className="h-3.5 w-3.5" /></span>
                      <span className="font-semibold text-[#1a1410]">{t("nav.dashboard", "Dashboard")}</span>
                    </Link>
                  )}
                  <div className="my-1 h-px bg-[#eadfce]" />
                  <button type="button" onClick={handleLogout} className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600 group-hover:bg-red-100"><LogOut className="h-3.5 w-3.5" /></span>
                    <span>{t("nav.sign_out", "Sign Out")}</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setDropdownOpen((p) => !p)} aria-haspopup="menu" aria-expanded={dropdownOpen} className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[#d9d3c8] bg-white px-4 text-[12px] font-semibold text-[#1a1410] shadow-sm transition-colors hover:border-[#EB6D3D]/60 hover:bg-[#faf6ef]">
                  <User size={14} />
                  <span>{t("nav.sign_in", "Sign In")}</span>
                </button>
                <div role="menu" className={`absolute right-0 top-full z-50 mt-2 w-52 origin-top-right rounded-2xl border border-[#eadfce] bg-white p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-all duration-150 ease-out ${dropdownOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"}`}>
                  <Link href="/auth/signin" role="menuitem" onClick={closeAllMenus} className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#1a1410] transition-colors hover:bg-[#faf6ef] hover:text-[#EB6D3D]">
                    <LogIn size={14} className="text-[#7a6a58] transition-colors group-hover:text-[#EB6D3D]" />
                    <span>{t("nav.sign_in", "Sign In")}</span>
                  </Link>
                  <Link href="/auth/register" role="menuitem" onClick={closeAllMenus} className="group mt-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#1a1410] transition-colors hover:bg-[#faf6ef] hover:text-[#EB6D3D]">
                    <UserPlus size={14} className="text-[#7a6a58] transition-colors group-hover:text-[#EB6D3D]" />
                    <span>{t("nav.sign_up", "Create Account")}</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/checkout" onClick={closeAllMenus} aria-label={`${t("nav.cart", "Cart")}, ${cartCount}`} className={`relative flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold shadow-sm transition-colors duration-300 ${iconBtnClass} w-auto`}>
            <ShoppingCart size={15} />
            <span className="flex min-w-4 items-center justify-center rounded-full bg-[#F47822] px-1 py-0.5 text-[10px] font-bold text-white">{cartCount > 99 ? "99+" : cartCount}</span>
          </Link>
          <button type="button" onClick={() => setSearchOpen((o) => !o)} aria-label="Search" className={iconBtnClass}>
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label={menuOpen ? "Close menu" : "Open menu"} className={iconBtnClass}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div id="navbar-search-panel" className="border-t border-black/10 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="mx-auto w-[min(1180px,calc(100%-24px))]">
            <SearchBar value={searchQuery} onChange={setSearchQuery} onSubmit={handleSearch} placeholder={searchPlaceholder} className="w-full" />
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-black/10 bg-[#f4f2ee] px-6 py-4 text-[#1a1410] shadow-xl lg:hidden">
          <div className="flex flex-col gap-2">
            <Link href="/" onClick={closeAllMenus} className="rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider">{t("nav.home", "Home")}</Link>
            <button type="button" onClick={() => setMobileProductsOpen((o) => !o)} className="flex items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider">
              <span>{t("nav.products", "Products")}</span>
              <ChevronRight size={14} className={`transition-transform ${mobileProductsOpen ? "rotate-90" : ""}`} />
            </button>
            {mobileProductsOpen && (
              <div className="ml-3 flex flex-col gap-1 border-l border-[#d9d3c8] pl-3">
                <Link href="/shop" onClick={closeAllMenus} className="py-1.5 text-xs font-medium text-[#cf5427]">{t("nav.shop", "Shop")}</Link>
                {displayCategories.map((cat) => (
                  <Link key={cat.id} href={`/shop?category=${encodeURIComponent(cat.slug || cat.id)}`} onClick={closeAllMenus} className="py-1.5 text-xs text-[#1a1410]/80">{cat.name}</Link>
                ))}
              </div>
            )}
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeAllMenus} className="rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider">{link.label}</Link>
            ))}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3">
              <div className="flex items-center gap-1 rounded-full border border-[#d9d3c8] bg-white p-0.5">
                {(["en", "am"] as const).map((lang) => (
                  <button key={lang} type="button" onClick={() => setLanguage(lang)} style={lang === "am" ? { fontFamily: ETHIOPIC_FONT } : undefined} className={`h-7 rounded-full px-2.5 text-[10px] font-bold ${language === lang ? "bg-[#EB6D3D] text-[#20283a]" : "text-[#1a1410]/70"}`}>
                    {lang === "en" ? "EN" : "አማ"}
                  </button>
                ))}
              </div>
              <button type="button" onClick={toggleTheme} className="flex h-8 items-center gap-1.5 rounded-full border border-[#d9d3c8] bg-white px-3 text-xs font-medium">
                {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                <span>{theme === "dark" ? "Light" : "Dark"}</span>
              </button>
              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <Link href="/profile" onClick={closeAllMenus} className="rounded-full bg-[#e0a83c] px-3 py-1.5 text-xs font-semibold text-[#1a1410]">{t("nav.profile", "Profile")}</Link>
                  <button type="button" onClick={handleLogout} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">{t("nav.sign_out", "Sign Out")}</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/auth/signin" onClick={closeAllMenus} className="rounded-full border border-[#d9d3c8] bg-white px-3 py-1.5 text-xs font-semibold">{t("nav.sign_in", "Sign In")}</Link>
                  <Link href="/auth/register" onClick={closeAllMenus} className="rounded-full bg-[#EB6D3D] px-3 py-1.5 text-xs font-semibold text-white">{t("nav.sign_up", "Create Account")}</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;