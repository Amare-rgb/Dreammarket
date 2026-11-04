// components/layout/Navbar.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  User,
  LogIn,
  LogOut,
  UserPlus,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Globe,
  Search,
  Sparkles,
  Building2,
  ShoppingBag,
  ShoppingCart,
  Moon,
  Sun,
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

interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string | null;
}

// ============================================================
// Brand
// ============================================================
const BRAND_TOP = "Dream More";
const BRAND_BOTTOM = "Affiliate Market";
const BRAND_ALT = "Dream More Affiliate Market";

const ETHIOPIC_FONT =
  "'Noto Sans Ethiopic','Nyala','Abyssinica SIL','Kefa','Ebrima',sans-serif";

function resolveCloudinaryUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
}

// ============================================================
// Fallback categories
// ============================================================
const FALLBACK_CATEGORIES: Category[] = [
  {
    id: "fb-containers",
    name: "Containers & Storage",
    slug: "containers",
    description: "Durable storage boxes, crates & bins",
    icon: "📦",
  },
  {
    id: "fb-household",
    name: "Household Plastic",
    slug: "household",
    description: "Buckets, basins, jugs & daily-use items",
    icon: "🪣",
  },
  {
    id: "fb-industrial",
    name: "Industrial Parts",
    slug: "industrial",
    description: "Heavy-duty plastic components & fittings",
    icon: "⚙️",
  },
  {
    id: "fb-packaging",
    name: "Packaging",
    slug: "packaging",
    description: "Bottles, caps, seals & custom packaging",
    icon: "🧴",
  },
  {
    id: "fb-pipes",
    name: "Pipes & Fittings",
    slug: "pipes",
    description: "PVC pipes, connectors & plumbing parts",
    icon: "🔧",
  },
  {
    id: "fb-custom",
    name: "Custom Manufacturing",
    slug: "custom",
    description: "Bespoke plastic products for your business",
    icon: "✦",
  },
];

// ============================================================
// External-store hooks
// ============================================================
function subscribeToScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

function useScrolled(threshold = 60) {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > threshold,
    () => false
  );
}

function subscribeToStoredUser(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("auth-change", callback);
  };
}

function getStoredUserRaw(): string | null {
  try {
    return localStorage.getItem("user");
  } catch {
    return null;
  }
}

function useStoredUser(): User | null {
  const raw = useSyncExternalStore(
    subscribeToStoredUser,
    getStoredUserRaw,
    () => null
  );

  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }, [raw]);
}

// ============================================================
// Avatar bubble — Cloudinary-only, falls back to initial
// ============================================================
function AvatarBubble({
  src,
  name,
  size,
}: {
  src?: string | null;
  name?: string | null;
  size: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolved = resolveCloudinaryUrl(src);
  const initial = name ? name.charAt(0).toUpperCase() : null;

  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-[#e0a83c] text-[#1a1410] font-bold overflow-hidden shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {resolved && !imgFailed ? (
        <Image
          src={resolved}
          alt={name || "User"}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
          unoptimized
        />
      ) : initial ? (
        initial
      ) : (
        <User style={{ width: size * 0.55, height: size * 0.55 }} />
      )}
    </div>
  );
}

// ============================================================
// Search bar
// ============================================================
function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
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
      <button
        type="submit"
        aria-label="Search"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16233f] text-[#f0c872] transition-colors hover:bg-[#1f3159]"
      >
        <Sparkles size={14} />
      </button>
    </form>
  );
}

export const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartCount, setCartCount] = useState(0);
  // ✅ Fallback toggle if the Cloudinary logo fails to load
  const [logoFailed, setLogoFailed] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const productsDropdownRef = useRef<HTMLDivElement>(null);
  const productsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { user, status, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const scrolled = useScrolled(60);
  const localUser = useStoredUser();

  useEffect(() => {
    const updateCartCount = () => {
      const count = readCart().reduce((total, item) => total + item.quantity, 0);
      setCartCount(count);
    };

    updateCartCount();
    window.addEventListener("cart-change", updateCartCount);
    window.addEventListener("storage", updateCartCount);
    return () => {
      window.removeEventListener("cart-change", updateCartCount);
      window.removeEventListener("storage", updateCartCount);
    };
  }, []);

  const activeUser = useMemo(() => {
    if (status === "authenticated" && user) return user;
    if (localUser) return localUser;
    return null;
  }, [status, user, localUser]);

  const userRole = (activeUser?.role || "USER").toUpperCase();
  const isAdmin = userRole === "ADMIN";
  const isAuthenticated =
    status === "authenticated" || (status !== "unauthenticated" && !!activeUser);

  const isAdminRoute = pathname?.startsWith("/admin") || false;
  const isHome =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/shop" ||
    pathname === "/contact";

  useEffect(() => {
    let isMounted = true;

    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
          }/api/categories`
        );

        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          const cats = Array.isArray(data) ? data : data.data || [];
          if (isMounted) setCategories(cats);
        } else {
          if (isMounted) setCategories(FALLBACK_CATEGORIES);
        }
      } catch {
        if (isMounted) setCategories(FALLBACK_CATEGORIES);
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        productsDropdownRef.current &&
        !productsDropdownRef.current.contains(e.target as Node)
      ) {
        setProductsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleProductsMouseEnter = () => {
    if (productsTimeoutRef.current) clearTimeout(productsTimeoutRef.current);
    setProductsDropdownOpen(true);
  };

  const handleProductsMouseLeave = () => {
    productsTimeoutRef.current = setTimeout(() => {
      setProductsDropdownOpen(false);
    }, 150);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMobileProductsOpen(false);
    setSearchOpen(false);
  };

  const closeAllMenus = () => {
    setMenuOpen(false);
    setMobileProductsOpen(false);
    setDropdownOpen(false);
    setProductsDropdownOpen(false);
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

  if (isAdminRoute) return null;

  const topCategories = categories.filter((c) => !c.parentId);
  const displayCategories =
    topCategories.length > 0
      ? topCategories
      : categories.length > 0
      ? categories
      : FALLBACK_CATEGORIES;

  const dynamicNavLinks = [
    { label: t("nav.articles", "Articles"), href: "/articles" },
    { label: t("nav.about", "About Us"), href: "/about" },
    { label: t("nav.contact", "Contact"), href: "/contact" },
  ];

  const searchPlaceholder = t(
    "nav.search_placeholder",
    "Search products, brands, categories…"
  );

  // ── Theme ─────────────────────────────────────────────────
  const solid = !isHome || scrolled || menuOpen;

  const headerClass = isHome
    ? `fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-gradient-to-r from-[#e4e1dc] via-[#f4f2ee] to-[#e4e1dc] border-b border-black/10 shadow-[0_8px_30px_rgba(0,0,0,.10)] backdrop-blur-md"
          : "bg-gradient-to-b from-black/60 via-black/25 to-transparent border-b border-transparent"
      }`
    : "relative z-50 w-full bg-gradient-to-r from-[#e4e1dc] via-[#f4f2ee] to-[#e4e1dc] border-b border-black/10 shadow-sm";

  const innerHeight = isHome && !scrolled ? "h-[80px]" : "h-[68px]";

  const logoBoxClass = solid
    ? "bg-white border-[#EB6D3D]/50"
    : "bg-white/90 border-[#EB6D3D]/60";

  const brandTopClass = solid ? "text-[#20283a]" : "text-white";
  const brandBottomClass = solid ? "text-[#d85d32]" : "text-[#ff9a68]";

  const navLinkClass = `group relative whitespace-nowrap py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
    solid
      ? "text-[#1a1410]/70 hover:text-[#1a1410]"
      : "text-white/80 hover:text-white"
  }`;

  const chevronClass = solid
    ? "text-[#1a1410]/50 group-hover:text-[#1a1410]"
    : "text-white/70 group-hover:text-white";

  const langWrapClass = solid
    ? "bg-white/70 border-[#d9d3c8]"
    : "bg-white/10 border-white/25 backdrop-blur-md";

  const langIdleClass = solid
    ? "text-[#1a1410]/60 hover:text-[#1a1410]"
    : "text-white/75 hover:text-white";

  const mobileCircleClass = solid
    ? "border-[#d9d3c8] bg-white/70 text-[#1a1410] hover:bg-white"
    : "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20";

  const accountBtnClass = solid
    ? "border-[#d9d3c8] bg-white text-[#1a1410] hover:bg-[#faf6ef] hover:border-[#e0a83c]/50"
    : "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20";

  const dropdownItemClass =
    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-medium text-[#1a1410]/80 hover:bg-[#faf6ef] hover:text-[#1a1410] group";
  const dropdownIconClass =
    "flex h-6 w-6 items-center justify-center rounded-lg bg-[#f7f8fa] border border-[#dfe3eb] text-[#30384f]/70 group-hover:bg-[#EB6D3D] group-hover:text-white transition-colors";

  return (
    <header className={headerClass}>
      <div
        className={`mx-auto flex w-[min(1180px,calc(100%-48px))] items-center justify-between gap-4 transition-all duration-300 xl:gap-6 ${innerHeight}`}
      >
        {/* Dream More brand logo */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          onClick={closeMenu}
          aria-label={BRAND_ALT}
        >
          <div
            className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm transition-colors duration-300 ${logoBoxClass}`}
          >
            {!logoFailed ? (
              <Image
                src="/banners/photo.jpg"
                alt={BRAND_ALT}
                width={48}
                height={48}
                className="h-full w-full object-contain"
                onError={() => setLogoFailed(true)}
                priority
              />
            ) : (
              <Building2 className="h-5 w-5 text-[#F47822]" />
            )}
          </div>
          <span className="flex flex-col whitespace-nowrap leading-none">
            <span
              className={`font-serif-heading text-[15px] font-bold tracking-[-0.01em] transition-colors duration-300 ${brandTopClass}`}
            >
              {BRAND_TOP}
            </span>
            <span
              className={`mt-1 text-[8px] font-semibold uppercase tracking-[0.22em] transition-colors duration-300 ${brandBottomClass}`}
            >
              {BRAND_BOTTOM}
            </span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden shrink-0 items-center gap-4 lg:flex xl:gap-6">
          <Link href="/" className={navLinkClass}>
            {t("nav.home", "Home")}
            <span
              className={`absolute -bottom-[1px] left-0 h-[2px] bg-[#e0a83c] transition-all duration-300 ${
                pathname === "/" ? "w-3" : "w-0 group-hover:w-3"
              }`}
            />
          </Link>

          {/* Products Dropdown */}
          <div
            className="relative"
            ref={productsDropdownRef}
            onMouseEnter={handleProductsMouseEnter}
            onMouseLeave={handleProductsMouseLeave}
          >
            <Link
              href="/shop"
              className={`${navLinkClass} flex items-center gap-1`}
            >
              <span>{t("nav.products", "Products")}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-150 ${
                  productsDropdownOpen
                    ? "rotate-180 text-[#e0a83c]"
                    : chevronClass
                }`}
              />
              <span
                className={`absolute -bottom-[1px] left-0 h-[2px] bg-[#e0a83c] transition-all duration-150 ${
                  pathname === "/shop" || productsDropdownOpen
                    ? "w-3"
                    : "w-0 group-hover:w-3"
                }`}
              />
            </Link>

            <div
              className={`absolute -left-6 sm:-left-12 lg:-left-20 xl:left-0 top-full mt-2 w-[580px] sm:w-[640px] max-w-[calc(100vw-2.5rem)] origin-top-left rounded-[24px] border border-[#eadfce] bg-white p-4 shadow-[0_30px_80px_rgba(0,0,0,0.25)] transition-all duration-100 ease-out z-50 ${
                productsDropdownOpen
                  ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
                  : "scale-95 opacity-0 -translate-y-3 pointer-events-none"
              }`}
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#eadfce]">
                <h4 className="text-xs font-semibold text-[#1a1410] tracking-wide">
                  {t("nav.categories", "Categories")}
                </h4>
                <Link
                  href="/shop"
                  onClick={closeAllMenus}
                  className="flex items-center gap-1.5 rounded-full border border-[#EB6D3D]/40 bg-[#faf6ef] px-2.5 py-1 text-[10px] font-semibold text-[#cf5427] hover:bg-[#EB6D3D] hover:text-[#20283a] transition-colors"
                >
                  <span>{t("nav.shop", "Shop")}</span> <ArrowUpRight size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2.5 max-h-[320px] overflow-y-auto pr-1">
                {displayCategories.slice(0, 9).map((cat) => {
                  const productCount = cat._count?.products;
                  const subCount = cat.children?.length || 0;
                  const imageSrc = resolveCloudinaryUrl(cat.image);
                  return (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${encodeURIComponent(
                        cat.slug || cat.id
                      )}`}
                      onClick={closeAllMenus}
                      className="group/cat flex items-start gap-2 p-2 rounded-xl border border-[#eadfce] bg-[#faf6ef] hover:bg-[#f4ecde] hover:border-[#e0a83c]/60 transition-all duration-200"
                    >
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-[#eadfce] overflow-hidden text-base group-hover/cat:scale-105 transition-transform">
                        {imageSrc ? (
                          <Image
                            src={imageSrc}
                            alt={cat.name}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span>{cat.icon || "📦"}</span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-[10px] font-bold text-[#1a1410] group-hover/cat:text-[#8a6212] transition-colors">
                            {cat.name}
                          </span>
                          {productCount !== undefined && productCount > 0 && (
                            <span className="shrink-0 rounded-full bg-[#1a1410]/10 px-1.5 py-0.2 text-[8px] font-medium text-[#1a1410]/70">
                              {productCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[9px] text-[#1a1410]/55">
                          {cat.description ||
                            (subCount > 0
                              ? `${subCount} ${t(
                                  "nav.subcategories",
                                  "subcategories"
                                )}`
                              : t("nav.quality_verified", "Quality assured"))}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-2.5 flex justify-end rounded-xl px-2 py-1">
                <Link
                  href="/shop"
                  onClick={closeAllMenus}
                  className="text-[10px] font-bold uppercase tracking-wider text-[#8a6212] hover:text-[#1a1410] transition-colors"
                >
                  {t("nav.view_all", "View All →")}
                </Link>
              </div>
            </div>
          </div>

          {dynamicNavLinks.map((link) => (
            <Link key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
              <span
                className={`absolute -bottom-[1px] left-0 h-[2px] bg-[#e0a83c] transition-all duration-300 ${
                  pathname === link.href ? "w-2" : "w-0 group-hover:w-2"
                }`}
              />
            </Link>
          ))}
        </nav>

        {/* Right Controls */}
        <div className="hidden shrink-0 items-center gap-2.5 lg:flex xl:gap-3">
          <Link
            href="/checkout"
            onClick={closeAllMenus}
            aria-label={`${t("nav.cart", "Cart")}, ${cartCount} ${t(
              "nav.cart_items",
              "items"
            )}`}
            title={t("nav.cart", "Cart")}
            className={`relative flex h-9 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold shadow-sm transition-colors duration-300 ${accountBtnClass}`}
          >
            <ShoppingCart size={15} />
            <span>{t("nav.cart", "Cart")}</span>
            <span className="flex min-w-5 items-center justify-center rounded-full bg-[#F47822] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors duration-300 ${mobileCircleClass}`}
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            aria-controls="navbar-search-panel"
            title={searchOpen ? "Close search" : "Search"}
          >
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors duration-300 ${mobileCircleClass}`}
            aria-label={t(
              theme === "dark" ? "nav.switch_to_light" : "nav.switch_to_dark",
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            )}
            title={t(
              theme === "dark" ? "nav.switch_to_light" : "nav.switch_to_dark",
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            )}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Language Switcher */}
          <div
            className={`flex h-9 items-center rounded-full border p-0.5 shadow-sm transition-colors duration-300 ${langWrapClass}`}
          >
            <Globe
              size={12}
              className="ml-1.5 mr-1 shrink-0 text-[#e0a83c]"
            />
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`flex h-7 min-w-[34px] items-center justify-center rounded-full px-2 text-[10px] font-bold transition-all duration-200 ${
                language === "en"
                  ? "bg-[#EB6D3D] text-[#20283a] shadow-sm"
                  : langIdleClass
              }`}
              aria-label="Switch to English"
              title="English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("am")}
              style={{ fontFamily: ETHIOPIC_FONT }}
              className={`flex h-7 min-w-[34px] items-center justify-center rounded-full px-2 text-[11px] font-bold transition-all duration-200 ${
                language === "am"
                  ? "bg-[#EB6D3D] text-[#20283a] shadow-sm"
                  : langIdleClass
              }`}
              aria-label="Switch to Amharic"
              title="አማርኛ"
            >
              አማ
            </button>
          </div>

          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[11px] font-medium shadow-sm transition-colors duration-300 ${accountBtnClass}`}
              >
                <AvatarBubble
                  src={activeUser?.avatar}
                  name={activeUser?.name}
                  size={20}
                />
                <span className="max-w-[80px] truncate text-[11px]">
                  {activeUser?.name || t("nav.account", "Account")}
                </span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    dropdownOpen
                      ? "rotate-180 text-[#e0a83c]"
                      : solid
                      ? "text-[#1a1410]/60"
                      : "text-white/70"
                  }`}
                />
              </button>

              <div
                className={`absolute right-0 top-full mt-2 w-56 origin-top-right rounded-xl border border-[#eadfce] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-all duration-150 ease-out z-50 ${
                  dropdownOpen
                    ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
                    : "scale-95 opacity-0 -translate-y-2 pointer-events-none"
                }`}
              >
                <div className="flex items-center gap-2 rounded-lg bg-[#faf6ef] p-2 border border-[#eadfce]">
                  <AvatarBubble
                    src={activeUser?.avatar}
                    name={activeUser?.name}
                    size={32}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-[10px] font-semibold text-[#1a1410]">
                        {activeUser?.name || t("nav.my_account", "My Account")}
                      </span>
                      <span className="shrink-0 rounded bg-[#e0a83c]/20 border border-[#e0a83c]/40 px-1 py-0.2 text-[7px] font-bold uppercase text-[#8a6212]">
                        {userRole}
                      </span>
                    </div>
                    <span className="truncate text-[9px] text-[#1a1410]/60">
                      {activeUser?.email || ""}
                    </span>
                  </div>
                </div>

                <div className="my-1 h-px bg-[#eadfce]" />

                <Link
                  href="/profile"
                  onClick={closeAllMenus}
                  className={dropdownItemClass}
                >
                  <span className={dropdownIconClass}>
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="font-semibold text-[#1a1410] text-[10px]">
                      {t("nav.profile", "Profile")}
                    </span>
                  </div>
                </Link>

                <Link
                  href="/orders"
                  onClick={closeAllMenus}
                  className={dropdownItemClass}
                >
                  <span className={dropdownIconClass}>
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="font-semibold text-[#1a1410] text-[10px]">
                      {t("nav.orders", "My Orders")}
                    </span>
                  </div>
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/dashboard"
                    onClick={closeAllMenus}
                    className={dropdownItemClass}
                  >
                    <span className={dropdownIconClass}>
                      <LayoutDashboard className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <span className="font-semibold text-[#1a1410] text-[10px]">
                        {t("nav.dashboard", "Dashboard")}
                      </span>
                    </div>
                  </Link>
                )}

                <div className="my-1 h-px bg-[#eadfce]" />

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 group"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50 text-red-600 group-hover:bg-red-100">
                    <LogOut className="h-3.5 w-3.5" />
                  </span>
                  <span>{t("nav.sign_out", "Sign Out")}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                className="flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[#d9d3c8] bg-white px-4 text-[12px] font-semibold text-[#1a1410] shadow-sm transition-colors hover:bg-[#faf6ef] hover:border-[#EB6D3D]/60"
              >
                <User size={14} />
                <span>{t("nav.sign_in", "Sign In")}</span>
              </button>

              <div
                role="menu"
                className={`absolute right-0 top-full z-50 mt-2 w-52 origin-top-right rounded-2xl border border-[#eadfce] bg-white p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-all duration-150 ease-out ${
                  dropdownOpen
                    ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none -translate-y-2 scale-95 opacity-0"
                }`}
              >
                <Link
                  href="/auth/signin"
                  role="menuitem"
                  onClick={closeAllMenus}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-[#1a1410] transition-colors hover:bg-[#faf6ef]"
                >
                  <LogIn size={16} className="text-[#1a1410]/80" />
                  <span>{t("nav.sign_in", "Sign In")}</span>
                </Link>
                <Link
                  href="/auth/register"
                  role="menuitem"
                  onClick={closeAllMenus}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-medium text-[#1a1410] transition-colors hover:bg-[#faf6ef]"
                >
                  <UserPlus size={16} className="text-[#1a1410]/80" />
                  <span>{t("nav.create_account", "Create Account")}</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Menu Controls */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/checkout"
            onClick={closeAllMenus}
            aria-label={`${t("nav.cart", "Cart")}, ${cartCount} ${t(
              "nav.cart_items",
              "items"
            )}`}
            className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-300 ${mobileCircleClass}`}
          >
            <ShoppingCart size={14} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F47822] px-1 text-[9px] font-bold text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open);
              setMenuOpen(false);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-300 ${mobileCircleClass}`}
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            aria-controls="navbar-search-panel"
          >
            {searchOpen ? <X size={14} /> : <Search size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "am" : "en")}
            style={{ fontFamily: ETHIOPIC_FONT }}
            className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] font-bold transition-colors duration-300 ${mobileCircleClass}`}
            aria-label="Toggle Language"
          >
            <Globe size={12} className="text-[#e0a83c]" />
            <span>{language === "en" ? "EN" : "አማ"}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-300 ${mobileCircleClass}`}
            aria-label={t(
              theme === "dark" ? "nav.switch_to_light" : "nav.switch_to_dark",
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            )}
            title={t(
              theme === "dark" ? "nav.switch_to_light" : "nav.switch_to_dark",
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            )}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-300 ${mobileCircleClass}`}
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div
          id="navbar-search-panel"
          className="absolute inset-x-0 top-full z-50 bg-transparent px-5 py-3"
        >
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
            placeholder={searchPlaceholder}
            className="mx-auto w-full max-w-2xl lg:max-w-[480px]"
          />
        </div>
      )}

      {/* Mobile Drawer */}
      <div
        className={`mx-auto w-[min(1180px,calc(100%-48px))] overflow-hidden transition-all duration-300 lg:hidden ${
          menuOpen
            ? "max-h-[720px] opacity-100 border-t border-black/10 py-2"
            : "pointer-events-none max-h-0 opacity-0"
        }`}
      >
        <nav className="p-2">
          {/* Mobile Language Selector */}
          <div className="flex items-center justify-between px-3 py-2 mb-1.5 rounded-lg bg-white/70 border border-[#d9d3c8]">
            <span className="flex items-center gap-2 text-xs font-semibold text-[#1a1410]/80">
              <Globe size={14} className="text-[#b8841f]" />
              <span>{t("nav.language", "Language")}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  language === "en"
                    ? "bg-[#EB6D3D] text-[#20283a]"
                    : "text-[#1a1410]/60 hover:text-[#1a1410] bg-white border border-[#eadfce]"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("am")}
                style={{ fontFamily: ETHIOPIC_FONT }}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  language === "am"
                    ? "bg-[#EB6D3D] text-[#20283a]"
                    : "text-[#1a1410]/60 hover:text-[#1a1410] bg-white border border-[#eadfce]"
                }`}
              >
                አማርኛ
              </button>
            </div>
          </div>

          <Link
            href="/"
            onClick={closeMenu}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-[#1a1410]/80 hover:bg-white/70 hover:text-[#1a1410]"
          >
            <span className="flex items-center gap-2">
              <span className="text-[8px] font-bold tracking-widest text-[#b8841f]">
                01
              </span>{" "}
              {t("nav.home", "Home")}
            </span>
            <ArrowUpRight size={14} className="text-[#1a1410]/40" />
          </Link>

          <div>
            <button
              onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-[#1a1410]/80 hover:bg-white/70 hover:text-[#1a1410]"
            >
              <span className="flex items-center gap-2">
                <span className="text-[8px] font-bold tracking-widest text-[#b8841f]">
                  02
                </span>{" "}
                {t("nav.products", "Products")}
              </span>
              <ChevronDown
                size={14}
                className={`text-[#1a1410]/40 transition-transform ${
                  mobileProductsOpen ? "rotate-180 text-[#b8841f]" : ""
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                mobileProductsOpen
                  ? "max-h-[300px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="mx-2 mb-2 rounded-xl bg-white/70 border border-[#d9d3c8] p-2 space-y-1">
                <Link
                  href="/shop"
                  onClick={closeMenu}
                  className="flex items-center justify-between rounded-lg bg-[#e0a83c]/15 border border-[#e0a83c]/40 px-2.5 py-1.5 text-[10px] font-bold text-[#8a6212] hover:bg-[#e0a83c]/25 transition"
                >
                  <span>{t("nav.browse_all", "✦ Browse All")}</span>{" "}
                  <ArrowUpRight size={12} />
                </Link>
                <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                  {displayCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${encodeURIComponent(
                        cat.slug || cat.id
                      )}`}
                      onClick={closeMenu}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px] text-[#1a1410]/75 hover:bg-white hover:text-[#1a1410] transition"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{cat.icon || "📦"}</span>
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <ChevronRight size={12} className="text-[#1a1410]/30" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {dynamicNavLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-[#1a1410]/80 hover:bg-white/70 hover:text-[#1a1410]"
            >
              <span className="flex items-center gap-2">
                <span className="text-[8px] font-bold tracking-widest text-[#b8841f]">
                  0{index + 3}
                </span>{" "}
                {link.label}
              </span>
              <ArrowUpRight size={14} className="text-[#1a1410]/40" />
            </Link>
          ))}

          <Link
            href="/checkout"
            onClick={closeMenu}
            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-[#1a1410]/90 hover:bg-white/70"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={14} className="text-[#b8841f]" />
              {t("nav.cart", "Cart")}
            </span>
            <span className="rounded-full bg-[#F47822] px-2 py-0.5 text-[10px] font-bold text-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          </Link>

          {isAuthenticated ? (
            <div className="mt-2 border-t border-black/10 pt-2 space-y-1">
              <div className="flex items-center gap-2 rounded-lg bg-white/70 p-2 border border-[#d9d3c8] mb-1.5">
                <AvatarBubble
                  src={activeUser?.avatar}
                  name={activeUser?.name}
                  size={28}
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-[#1a1410]">
                      {activeUser?.name || t("nav.my_account", "My Account")}
                    </span>
                    <span className="rounded bg-[#e0a83c]/20 border border-[#e0a83c]/40 px-1 py-0.2 text-[7px] font-bold uppercase text-[#8a6212]">
                      {userRole}
                    </span>
                  </div>
                  <span className="truncate text-[9px] text-[#1a1410]/55">
                    {activeUser?.email || ""}
                  </span>
                </div>
              </div>

              <Link
                href="/profile"
                onClick={closeMenu}
                className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#1a1410]/90 hover:bg-white/70 hover:text-[#1a1410]"
              >
                <span className="flex items-center gap-2">
                  <User size={14} /> {t("nav.profile", "Profile")}
                </span>
                <ArrowUpRight size={14} className="text-[#1a1410]/40" />
              </Link>

              <Link
                href="/orders"
                onClick={closeMenu}
                className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#1a1410]/90 hover:bg-white/70 hover:text-[#1a1410]"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag size={14} /> {t("nav.orders", "My Orders")}
                </span>
                <ArrowUpRight size={14} className="text-[#1a1410]/40" />
              </Link>

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={closeMenu}
                  className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs text-[#1a1410]/90 hover:bg-white/70 hover:text-[#1a1410]"
                >
                  <span className="flex items-center gap-2">
                    <LayoutDashboard size={14} />{" "}
                    {t("nav.dashboard", "Dashboard")}
                  </span>
                  <ArrowUpRight size={14} className="text-[#1a1410]/40" />
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <span className="flex items-center gap-2">
                  <LogOut size={14} /> {t("nav.sign_out", "Sign Out")}
                </span>
              </button>
            </div>
          ) : (
            <div className="mt-2 border-t border-black/10 pt-2 space-y-1">
              <Link
                href="/auth/signin"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[#1a1410]/90 hover:bg-white/70 hover:text-[#1a1410]"
              >
                <LogIn size={15} />
                {t("nav.sign_in", "Sign In")}
              </Link>
              <Link
                href="/auth/register"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-[#1a1410]/90 hover:bg-white/70 hover:text-[#1a1410]"
              >
                <UserPlus size={15} />
                {t("nav.create_account", "Create Account")}
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;