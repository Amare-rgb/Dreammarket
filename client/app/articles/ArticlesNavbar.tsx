"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Menu, X, Search, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicCategory } from "@/lib/publicArticles";
import { useLanguage } from "@/context/LanguageContext";

const LOGO_SRC = "/banners/photo.jpg";
const BRAND_NAME = "Dream More";
const BRAND_TAGLINE = "Affiliate Market";

export default function ArticlesNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();

  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [dropdownPath, setDropdownPath] = useState<string | null>(null);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  // Track user typed input. If null, we fall back to the URL search value.
  const [searchInput, setSearchInput] = useState<string | null>(null);

  const urlSearch = searchParams.get("search") || "";
  const searchQuery = searchInput !== null ? searchInput : urlSearch;

  const menuOpen = menuPath === pathname;
  const dropdownOpen = dropdownPath === pathname;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    api
      .get("/api/articles/categories")
      .then((res) => {
        if (active) setCategories(res.data?.categories || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Close the dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownPath(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDropdownPath(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  // Close the mobile menu with Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  const closeAll = () => {
    setMenuPath(null);
    setDropdownPath(null);
    setSearchOpen(false);
    setSearchInput(null); // Reset input to sync with URL again
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    closeAll();

    // Preserve the category if one is selected
    const currentCategory = searchParams.get("category");
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    if (currentCategory) params.set("category", currentCategory);

    const queryString = params.toString();
    router.push(`/articles${queryString ? `?${queryString}` : ""}`);
  };

  const isAll = pathname === "/articles";
  const isVideos = pathname === "/articles/videos";

  // Header text buttons: same height, soft orange tint when active
  const linkClass = (active: boolean) =>
    `inline-flex h-10 items-center whitespace-nowrap rounded-lg px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EB6D3D]/40 ${
      active
        ? "bg-[#EB6D3D]/10 text-[#c2491d]"
        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    }`;

  const mobileLinkClass = (active: boolean) =>
    `flex h-11 items-center rounded-lg px-4 text-sm font-semibold transition ${
      active
        ? "bg-[#EB6D3D]/10 text-[#c2491d]"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  const iconBtn =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EB6D3D]/40";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo lockup: icon + serif brand name + spaced orange tagline */}
        <Link
          href="/articles"
          onClick={closeAll}
          aria-label="Dream More Affiliate Market home"
          className="flex shrink-0 items-center gap-3"
        >
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50 border border-slate-100">
            <Image
              src={LOGO_SRC}
              alt="Dream More Logo"
              width={96}
              height={96}
              unoptimized
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <span className="flex flex-col leading-none">
            {/* Using a robust serif stack to match the image */}
            <span 
              className="text-xl font-extrabold tracking-tight text-[#20283a] sm:text-2xl"
              style={{ fontFamily: "'Merriweather', 'Playfair Display', Georgia, serif" }}
            >
              {BRAND_NAME}
            </span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#EB6D3D] sm:text-[11px]">
              {BRAND_TAGLINE}
            </span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Articles navigation" className="hidden items-center gap-1 lg:flex">
          <Link href="/" className={linkClass(false)}>
            {t("articles.nav_home", "Home")}
          </Link>
          <Link
            href="/articles"
            aria-current={isAll ? "page" : undefined}
            className={linkClass(isAll)}
          >
            {t("articles.nav_all", "All articles")}
          </Link>
          <Link
            href="/articles/videos"
            aria-current={isVideos ? "page" : undefined}
            className={linkClass(isVideos)}
          >
            {t("articles.nav_videos", "Videos")}
          </Link>
          <Link href="/about" className={linkClass(false)}>
            {t("nav.about", "About Us")}
          </Link>
          <Link href="/training" className={linkClass(false)}>
            {t("nav.training", "Training")}
          </Link>
          <Link href="/resources" className={linkClass(false)}>
            {t("nav.resources", "Free Resources")}
          </Link>
          <Link
            href="/newsletter"
            className="ml-1 inline-flex h-10 items-center whitespace-nowrap rounded-lg bg-[#1d4ed8] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]/50"
          >
            Edit Smarter
          </Link>

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownPath(dropdownOpen ? null : pathname)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              className={`${linkClass(dropdownOpen)} gap-1`}
            >
              {t("articles.nav_categories", "Categories")}
              <ChevronDown
                size={16}
                className={`transition ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                {categories.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">
                    {t("articles.no_categories", "No categories yet.")}
                  </p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {categories.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/articles?category=${c.slug}`}
                          onClick={closeAll}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-[#EB6D3D]/10 hover:text-[#c2491d]"
                        >
                          <span>{language === "am" && c.nameAm ? c.nameAm : c.name}</span>
                          <span className="text-xs text-slate-400">{c.count}</span>
                        </Link>
                        {c.subcategories && c.subcategories.length > 0 && (
                          <ul className="ml-3 border-l border-slate-200 pl-2">
                            {c.subcategories.map((sub) => (
                              <li key={sub.id}>
                                <Link
                                  href={`/articles?category=${sub.slug}`}
                                  onClick={closeAll}
                                  className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-[#EB6D3D]/10 hover:text-[#c2491d]"
                                >
                                  <span>{language === "am" && sub.nameAm ? sub.nameAm : sub.name}</span>
                                  <span className="text-xs text-slate-400">{sub.count}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <span aria-hidden="true" className="mx-2 h-6 w-px bg-slate-200" />

          {/* Search toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-expanded={searchOpen}
            className={iconBtn}
            aria-label={t("articles.search_aria", "Search articles")}
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>

          {/* Primary action */}
          <Link
            href="/shop"
            className="ml-2 inline-flex h-10 items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c2491d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EB6D3D]/50 focus-visible:ring-offset-2"
          >
            <ShoppingBag size={16} />
            {t("nav.store", "Store")}
          </Link>
        </nav>

        {/* Mobile / tablet buttons */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(!searchOpen);
              setMenuPath(null);
            }}
            aria-expanded={searchOpen}
            className={iconBtn}
            aria-label={t("articles.search_aria", "Search articles")}
          >
            {searchOpen ? <X size={20} /> : <Search size={20} />}
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuPath(menuOpen ? null : pathname);
              setSearchOpen(false);
            }}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className={iconBtn}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Expandable search bar */}
      {searchOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-inner animate-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSearch} className="relative mx-auto max-w-3xl">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("articles.search_placeholder", "Search articles...")}
              className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-28 text-sm text-slate-900 outline-none transition focus:border-[#EB6D3D] focus:bg-white focus:ring-2 focus:ring-[#EB6D3D]/20"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 h-8 rounded-lg bg-[#EB6D3D] px-4 text-xs font-bold text-white transition hover:bg-[#c2491d]"
            >
              {t("articles.search_button", "Search")}
            </button>
          </form>
        </div>
      )}

      {/* Mobile navigation */}
      {menuOpen && (
        <nav
          aria-label="Articles navigation"
          className="max-h-[calc(100vh-4.5rem)] overflow-y-auto border-t border-slate-100 bg-white px-4 pb-4 pt-3 lg:hidden animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex flex-col gap-1">
            <Link href="/" onClick={closeAll} className={mobileLinkClass(false)}>
              {t("articles.nav_home", "Home")}
            </Link>
            <Link
              href="/articles"
              onClick={closeAll}
              aria-current={isAll ? "page" : undefined}
              className={mobileLinkClass(isAll)}
            >
              {t("articles.nav_all", "All articles")}
            </Link>
            <Link
              href="/articles/videos"
              onClick={closeAll}
              aria-current={isVideos ? "page" : undefined}
              className={mobileLinkClass(isVideos)}
            >
              {t("articles.nav_videos", "Videos")}
            </Link>
            <Link href="/about" onClick={closeAll} className={mobileLinkClass(false)}>
              {t("nav.about", "About Us")}
            </Link>
            <Link href="/training" onClick={closeAll} className={mobileLinkClass(false)}>
              {t("nav.training", "Training")}
            </Link>
            <Link href="/resources" onClick={closeAll} className={mobileLinkClass(false)}>
              {t("nav.resources", "Free Resources")}
            </Link>
            <Link
              href="/newsletter"
              onClick={closeAll}
              className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-[#1d4ed8] px-4 text-sm font-bold text-white transition hover:bg-[#1e40af]"
            >
              Edit Smarter
            </Link>
            <Link
              href="/shop"
              onClick={closeAll}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-[#EB6D3D] px-4 text-sm font-bold text-white transition hover:bg-[#c2491d]"
            >
              <ShoppingBag size={16} />
              {t("nav.store", "Store")}
            </Link>
          </div>

          {categories.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {t("articles.nav_categories", "Categories")}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/articles?category=${c.slug}`}
                      onClick={closeAll}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-[#EB6D3D]/15 hover:text-[#c2491d]"
                    >
                      {language === "am" && c.nameAm ? c.nameAm : c.name}
                      <span className="text-xs text-slate-400">{c.count}</span>
                    </Link>
                    {c.subcategories?.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/articles?category=${sub.slug}`}
                        onClick={closeAll}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-[#EB6D3D]/15 hover:text-[#c2491d]"
                      >
                        {language === "am" && sub.nameAm ? sub.nameAm : sub.name}
                        <span className="text-xs text-slate-400">{sub.count}</span>
                      </Link>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}