"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Menu, X, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicCategory } from "@/lib/publicArticles";

const LOGO_SRC = "/banners/photo.jpg";

export default function ArticlesNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
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

  const linkClass = (active: boolean) =>
    `inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
      active
        ? "bg-[#20283a] text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <header className="relative z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/articles"
          onClick={closeAll}
          aria-label="Dream More Articles home"
          className="flex items-center gap-3"
        >
          <Image
            src={LOGO_SRC}
            alt="Dream More"
            width={80}
            height={80}
            unoptimized
            priority
            className="h-10 w-10 rounded-lg object-contain"
          />
          <span className="text-lg font-bold leading-none text-slate-900">
            Dream More <span className="text-[#cf5427]">Articles</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Articles navigation" className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkClass(false)}>
            Home
          </Link>
          <Link
            href="/articles"
            aria-current={isAll ? "page" : undefined}
            className={linkClass(isAll)}
          >
            All articles
          </Link>
          <Link
            href="/articles/videos"
            aria-current={isVideos ? "page" : undefined}
            className={linkClass(isVideos)}
          >
            Videos
          </Link>

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setDropdownPath(dropdownOpen ? null : pathname)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              className={`${linkClass(false)} gap-1.5`}
            >
              Categories
              <ChevronDown
                size={16}
                className={`transition ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {categories.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500">No categories yet.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {categories.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/articles?category=${c.slug}`}
                          onClick={closeAll}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-[#EB6D3D]/10 hover:text-[#9c3d1a]"
                        >
                          <span>{c.name}</span>
                          <span className="text-xs text-slate-400">{c.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          
          {/* Search Toggle Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Search articles"
          >
            {searchOpen ? <X size={18} /> : <Search size={18} />}
          </button>
        </nav>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => {
              setSearchOpen(!searchOpen);
              setMenuPath(null);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
            aria-label="Search articles"
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
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 shadow-inner">
          <form onSubmit={handleSearch} className="mx-auto max-w-3xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-24 text-sm text-slate-900 outline-none transition focus:border-[#EB6D3D] focus:bg-white focus:ring-2 focus:ring-[#EB6D3D]/20"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 h-8 rounded-lg bg-[#20283a] px-4 text-xs font-semibold text-white transition hover:bg-[#EB6D3D]"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile navigation */}
      {menuOpen && (
        <nav
          aria-label="Articles navigation"
          className="border-t border-slate-100 bg-white px-4 pb-4 pt-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            <Link href="/" onClick={closeAll} className={linkClass(false)}>
              Home
            </Link>
            <Link
              href="/articles"
              onClick={closeAll}
              aria-current={isAll ? "page" : undefined}
              className={linkClass(isAll)}
            >
              All articles
            </Link>
            <Link
              href="/articles/videos"
              onClick={closeAll}
              aria-current={isVideos ? "page" : undefined}
              className={linkClass(isVideos)}
            >
              Videos
            </Link>
          </div>

          {categories.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="px-4 text-xs font-bold uppercase tracking-wide text-slate-400">
                Categories
              </p>
              <ul className="mt-2 flex flex-wrap gap-2 px-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/articles?category=${c.slug}`}
                      onClick={closeAll}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-[#EB6D3D]/15 hover:text-[#9c3d1a]"
                    >
                      {c.name}
                      <span className="text-xs text-slate-400">{c.count}</span>
                    </Link>
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