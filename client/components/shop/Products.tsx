// components/shop/Products.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Search, ShoppingCart, Trash2, Video, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";
import ProductCountdown from "./ProductCountdown";

export interface ProductPrice {
  currency: string;
  amount: number;
}

export interface ProductReward {
  id: string;
  name: string;
  triggerType: string;
  threshold: number;
  rewardType: string;
  rewardValue: string;
  currency?: string | null;
  promoCode: string | null;
  expiresAt?: string | null;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  currency: string;
  prices: ProductPrice[];
  discountPrice: number | null;
  discountPrices?: { currency: string; amount: number }[] | null;
  unit: string;
  stock: number;
  availabilityStatus?: string;
  availableAt?: string | null;
  restockDate?: string | null;
  saleEndDate?: string | null;
  featured?: boolean;
  badge?: string;
  images: string[];
  videoUrl: string | null;
  liters?: number | null;
  sizes?: string[];
  rewards?: ProductReward[];
}

type SortOption = "size-low" | "size-high" | "price-low" | "price-high" | "name";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

interface ApiProduct {
  id?: string;
  _id?: string;
  slug?: string;
  name: string;
  category?: { name?: string } | null;
  categoryName?: string;
  description?: string | null;
  price?: number | string;
  currency?: string;
  prices?: { currency?: string; amount?: number | string }[] | null;
  discountPrice?: number | string | null;
  discountPrices?: { currency: string; amount: number }[] | null;
  unitOfMeasurement?: string | null;
  stock?: number | null;
  availabilityStatus?: string | null;
  availableAt?: string | null;
  restockDate?: string | null;
  saleEndDate?: string | null;
  isFeatured?: boolean;
  images?: string[] | null;
  videoUrl?: string | null;
  video?: string | null;
  liters?: number | string | null;
  volume?: number | string | null;
  size?: string | null;
  capacity?: string | null;
  sizesList?: { size?: string; stock?: number }[] | null;
  rewardRules?: ProductReward[] | null;
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const DEFAULT_CURRENCY = "ETB";
const LITER_BUCKETS = [
  { max: 1, label: "Under 1L", val: 0.5 },
  { max: 1, label: "1L", val: 1 },
  { max: 2, label: "2L", val: 2 },
  { max: 5, label: "5L", val: 5 },
  { max: 10, label: "10L", val: 10 },
  { max: 20, label: "20L", val: 20 },
  { max: 25, label: "25L", val: 25 },
  { max: 30, label: "30L", val: 30 },
  { max: 50, label: "50L", val: 50 },
  { max: 100, label: "100L", val: 100 },
  { max: 200, label: "200L", val: 200 },
  { max: 1000, label: "1000L (IBC)", val: 1000 },
  { max: Infinity, label: "Over 1000L", val: 99999 },
];

const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY) {
  if (!Number.isFinite(amount)) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function resolveMediaUrl(raw: unknown, allowData: boolean): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (allowData && s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("res.cloudinary.com/") ? `https://${s}` : null;
}

function normalizePrices(p: ApiProduct): ProductPrice[] {
  const list: ProductPrice[] = [];
  if (Array.isArray(p.prices)) {
    for (const raw of p.prices) {
      const currency = typeof raw?.currency === "string" && raw.currency.trim() ? raw.currency.toUpperCase() : null;
      const amount = Number(raw?.amount);
      if (currency && isPositive(amount)) list.push({ currency, amount });
    }
  }
  if (!list.length) {
    const amount = Number(p.price);
    const currency = typeof p.currency === "string" && p.currency.trim() ? p.currency.toUpperCase() : DEFAULT_CURRENCY;
    list.push({ currency, amount: isPositive(amount) ? amount : 0 });
  }
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(x.currency) ? false : (seen.add(x.currency), true)));
}

function detectLiters(product: {
  name?: string;
  description?: string;
  liters?: number | string | null;
  volume?: number | string | null;
  size?: string | null;
  capacity?: string | null;
}): number | null {
  const tryParse = (val: unknown): number | null => {
    if (typeof val === "number" && !Number.isNaN(val) && val > 0) return val;
    if (typeof val === "string") {
      const m = val.match(/(\d+(?:\.\d+)?)\s*(?:l|lt|ltr|liter|litre|liters|litres)\b/i);
      if (m) {
        const n = parseFloat(m[1]);
        return Number.isNaN(n) ? null : n;
      }
    }
    return null;
  };
  return (
    tryParse(product.liters) ??
    tryParse(product.volume) ??
    tryParse(product.size) ??
    tryParse(product.capacity) ??
    tryParse(`${product.name || ""} ${product.description || ""}`)
  );
}

function literBucket(liters: number): string {
  if (liters < 1) return "Under 1L";
  return (LITER_BUCKETS.slice(1).find((b) => liters <= b.max) || LITER_BUCKETS[LITER_BUCKETS.length - 1]).label;
}

function parseBucketValue(label: string): number {
  return LITER_BUCKETS.find((b) => b.label === label)?.val ?? 0;
}

function rewardBadgeText(r: ProductReward): string {
  const trigger = r.triggerType === "MIN_QUANTITY" ? `Buy ${Number(r.threshold)}+` : `Spend ${Number(r.threshold).toLocaleString()}+ ETB`;
  const reward =
    r.rewardType === "PERCENT_DISCOUNT" ? `${r.rewardValue}% off` : r.rewardType === "FREE_ITEM" ? `Free ${r.rewardValue}` : `${r.rewardValue} ETB reward`;
  return `${trigger} → ${reward}`;
}

function matchesCategoryName(productCategory: string, selected: string): boolean {
  const p = productCategory.toLowerCase().trim();
  const s = selected.toLowerCase().trim();
  return s === "all" || p === s || p.includes(s) || s.includes(p);
}

function getEffectivePrice(product: Product): number {
  if (Array.isArray(product.discountPrices)) {
    const match = product.discountPrices.find((d) => d.currency.toUpperCase() === product.currency.toUpperCase());
    if (match && match.amount > 0 && match.amount < product.price) return match.amount;
  }
  if (product.discountPrice != null && product.discountPrice > 0 && product.discountPrice < product.price) {
    return product.discountPrice;
  }
  return product.price;
}

function ProductImage({
  src,
  videoUrl,
  alt,
  priority = false,
}: {
  src: string | null;
  videoUrl?: string | null;
  alt: string;
  priority?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showVideo = Boolean(videoUrl) && hovering && !hasError;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showVideo) {
      v.muted = true;
      v.play()?.catch(() => {});
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
    }
  }, [showVideo]);

  if (!src || hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#2a1f18] text-[#e0a83c]/40">
        <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" onMouseEnter={() => videoUrl && setHovering(true)} onMouseLeave={() => setHovering(false)} onTouchStart={() => videoUrl && setHovering(true)}>
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        unoptimized
        className={`object-cover object-center transition-all duration-500 ease-out ${showVideo ? "opacity-0" : "opacity-100 group-hover:scale-[1.04]"}`}
        onError={() => setHasError(true)}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${showVideo ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        />
      )}
    </div>
  );
}

export default function Products() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "All";
  const hasInitializedURL = useRef(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const [isAdmin] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (!raw) return false;
    try {
      return String(JSON.parse(raw)?.role || "").toUpperCase() === "ADMIN";
    } catch {
      return false;
    }
  });

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedLiter, setSelectedLiter] = useState("All");
  const [selectedSize, setSelectedSize] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("size-low");
  const [cartFeedback, setCartFeedback] = useState<{ productId: string; message: string; isError: boolean } | null>(null);

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && cat !== selectedCategory && !hasInitializedURL.current) {
      hasInitializedURL.current = true;
      setSelectedCategory(cat);
    }
  }, [searchParams, selectedCategory]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/categories/public`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const list: CategoryOption[] = Array.isArray(data) ? data : data?.categories || [];
        if (list.length) {
          const top = list.filter((c) => !c.parentId);
          setCategoriesList((top.length ? top : list).map((c) => ({ id: c.id, name: c.name, slug: c.slug || c.name.toLowerCase(), parentId: c.parentId || null })));
        }
      })
      .catch((err) => console.warn("Could not fetch categories list:", err));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetch(`${API_BASE_URL}/api/products/public?limit=50`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const raw = Array.isArray(data) ? data : (data as { products?: unknown })?.products;
        if (!Array.isArray(raw) || !raw.length) return setProducts([]);

        const mapped: Product[] = (raw as ApiProduct[]).map((p) => {
          const prices = normalizePrices(p);
          const primary = prices[0];
          const hasDiscount = p.discountPrice != null && Number(p.discountPrice) > 0 && Number(p.discountPrice) < primary.amount;
          const stock = typeof p.stock === "number" && p.stock >= 0 ? p.stock : 0;
          return {
            id: p.id ?? p._id ?? "",
            slug: p.slug || p.id || p._id || "",
            name: p.name,
            category: p.category?.name || p.categoryName || "Other Products",
            description: p.description || "",
            price: primary.amount,
            currency: primary.currency,
            prices,
            discountPrice: hasDiscount ? Number(p.discountPrice) : null,
            discountPrices: Array.isArray(p.discountPrices) ? p.discountPrices : null,
            unit: p.unitOfMeasurement || "pcs",
            stock,
            availabilityStatus: p.availabilityStatus || undefined,
            availableAt: p.availableAt || null,
            restockDate: p.restockDate || null,
            saleEndDate: p.saleEndDate || null,
            featured: hasDiscount || Boolean(p.isFeatured),
            badge: hasDiscount ? "Sale" : undefined,
            images: (Array.isArray(p.images) ? p.images : []).map((img) => resolveMediaUrl(img, true)).filter((u): u is string => Boolean(u)),
            videoUrl: resolveMediaUrl(p.videoUrl ?? p.video, false),
            liters: detectLiters({ name: p.name, description: p.description || "", liters: p.liters, volume: p.volume, size: p.size, capacity: p.capacity }),
            sizes: (Array.isArray(p.sizesList) ? p.sizesList : []).map((s) => (typeof s?.size === "string" ? s.size.trim() : "")).filter(Boolean),
            rewards: Array.isArray(p.rewardRules) ? p.rewardRules : [],
          };
        });
        setProducts(mapped);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load products");
        setProducts([]);
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const addToCart = (product: Product, image: string | null) => {
    try {
      const cart = readCart();
      const existing = cart.find((item) => item.productId === product.id);
      const nextQuantity = (existing?.quantity || 0) + 1;
      if (nextQuantity > product.stock) {
        return setCartFeedback({ productId: product.id, message: t("checkout.stock_limit", "There is not enough stock for another item."), isError: true });
      }
      const nextItem = { productId: product.id, name: product.name, slug: product.slug, image, unitPrice: getEffectivePrice(product), quantity: nextQuantity };
      writeCart(existing ? cart.map((item) => (item.productId === product.id ? nextItem : item)) : [...cart, nextItem]);
      setCartFeedback({ productId: product.id, message: t("checkout.added_to_cart", "Added to your order."), isError: false });
    } catch {
      setCartFeedback({ productId: product.id, message: t("checkout.cart_save_error", "Could not save your order. Please try again."), isError: true });
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) return;
    setDeletingCatId(categoryId);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/categories/${categoryId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to delete category");
      setCategoriesList((prev) => prev.filter((c) => c.id !== categoryId));
      if (selectedCategory.toLowerCase() === categoryName.toLowerCase()) setSelectedCategory("All");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeletingCatId(null);
    }
  };

  const literTabs = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.liters && p.liters > 0 && set.add(literBucket(p.liters)));
    const sorted = Array.from(set).sort((a, b) => parseBucketValue(a) - parseBucketValue(b));
    return sorted.length ? ["All", ...sorted] : [];
  }, [products]);

  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (p.sizes || []).forEach((s) => s && set.add(s)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [products]);

  const categoryTabs = useMemo(() => {
    const set = new Set<string>(["All"]);
    categoriesList.forEach((c) => set.add(c.name));
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set);
  }, [categoriesList, products]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = products.filter((p) => {
      const okCat = matchesCategoryName(p.category || "", selectedCategory);
      const okLiter = selectedLiter === "All" || (p.liters != null && p.liters > 0 && literBucket(p.liters) === selectedLiter);
      const okSize = selectedSize === "All" || (p.sizes || []).some((s) => s.toLowerCase() === selectedSize.toLowerCase());
      const okSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.sizes || []).some((s) => s.toLowerCase().includes(q));
      return okCat && okLiter && okSize && okSearch;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "size-low":
          return (a.liters ?? Number.POSITIVE_INFINITY) - (b.liters ?? Number.POSITIVE_INFINITY);
        case "size-high":
          return (b.liters ?? -1) - (a.liters ?? -1);
        case "price-low":
          return (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price);
        case "price-high":
          return (b.discountPrice ?? b.price) - (a.discountPrice ?? a.price);
        case "name":
          return a.name.localeCompare(b.name);
      }
    });
  }, [products, selectedCategory, selectedLiter, selectedSize, search, sort]);

  const hasFilters = selectedCategory.toLowerCase() !== "all" || selectedLiter !== "All" || selectedSize !== "All" || search.trim() !== "";
  const clearFilters = () => {
    setSelectedCategory("All");
    setSelectedLiter("All");
    setSelectedSize("All");
    setSearch("");
  };

  return (
    <main className="shop-theme min-h-screen bg-[var(--cream)]">
      <section className="relative overflow-hidden bg-[#1a1410] px-5 pb-16 pt-28 sm:px-8 lg:px-12 lg:pb-20 lg:pt-36">
        <div className="pointer-events-none absolute -right-24 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#e0a83c]/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#b98a3e]/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h1 className="font-serif-heading text-5xl font-medium leading-[0.98] tracking-[-0.045em] text-[#faf6ee] sm:text-6xl lg:text-7xl">
              {t("shop.hero_title_1", "Discover more,")}
              <br />
              <span className="text-[#F47822]">{t("shop.hero_title_2", "all in one marketplace.")}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#faf6ee]/75 sm:text-lg">
              {t("shop.hero_subtitle", "Browse digital marketplace listings, compare product details, and find useful picks from a range of categories.")}
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
          <aside className="mb-6 rounded-2xl border border-[#3a2a1e]/10 bg-white p-3 shadow-[0_12px_30px_rgba(58,42,30,.05)] lg:sticky lg:top-24 lg:mb-0 lg:h-fit lg:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#b98a3e]">{t("shop.categories", "Categories")}</h2>
              {selectedCategory.toLowerCase() !== "all" && (
                <button type="button" onClick={() => setSelectedCategory("All")} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a6a58] hover:text-[#1a1410]">
                  {t("shop.clear", "Clear")}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {categoryTabs.map((category) => {
                const active = selectedCategory.toLowerCase() === category.toLowerCase();
                const catObj = categoriesList.find((c) => c.name === category);
                const count = products.filter((p) => matchesCategoryName(p.category || "", category)).length;

                return (
                  <div key={category} className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-all duration-200 ${active ? "bg-[#EB6D3D] text-[#20283a] shadow-md" : "bg-[#faf6ee] text-[#7a6a58] hover:bg-[#f0e8d8] hover:text-[#1a1410]"}`}>
                    <button type="button" onClick={() => setSelectedCategory(category)} className="flex-1 truncate text-left">
                      {category.toLowerCase() === "all" ? t("shop.category_all", "All") : category}
                    </button>
                    <div className="flex items-center gap-1">
                      {isAdmin && catObj && category !== "All" && (
                        <button
                          type="button"
                          disabled={deletingCatId === catObj.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCategory(catObj.id, catObj.name);
                          }}
                          title="Delete Category"
                          className={`rounded-md p-1 transition-colors ${active ? "text-[#20283a] hover:bg-[#20283a]/20" : "text-red-500 opacity-0 hover:bg-red-100 group-hover:opacity-100"}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? "bg-[#20283a] text-white" : "bg-white text-[#7a6a58]"}`}>
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-8 rounded-3xl border border-[#3a2a1e]/10 bg-white p-4 shadow-[0_15px_45px_rgba(58,42,30,.06)] sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6a58]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("shop.search_placeholder", "Search products, categories, and listings...")}
                    className="h-11 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 pl-11 pr-4 text-sm text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-4 focus:ring-[#e0a83c]/20"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {sizeOptions.length > 0 && (
                    <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className="h-10 rounded-full border border-[#3a2a1e]/10 bg-[#faf6ee] px-4 text-xs font-semibold text-[#1a1410] outline-none focus:border-[#b98a3e]">
                      <option value="All">{t("shop.all_sizes", "All Sizes")}</option>
                      {sizeOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className="h-10 rounded-full border border-[#3a2a1e]/10 bg-[#faf6ee] px-4 text-xs font-semibold text-[#1a1410] outline-none focus:border-[#b98a3e]">
                    <option value="size-low">{t("shop.sort_size_low", "Size: Small to Large")}</option>
                    <option value="size-high">{t("shop.sort_size_high", "Size: Large to Small")}</option>
                    <option value="price-low">{t("shop.sort_price_low", "Price: Low to High")}</option>
                    <option value="price-high">{t("shop.sort_price_high", "Price: High to Low")}</option>
                    <option value="name">{t("shop.sort_name", "Name: A to Z")}</option>
                  </select>
                </div>
              </div>

              {literTabs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#3a2a1e]/10 pt-4">
                  {literTabs.map((bucket) => (
                    <button key={bucket} type="button" onClick={() => setSelectedLiter(bucket)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${selectedLiter === bucket ? "bg-[#20283a] text-white" : "bg-[#faf6ee] text-[#7a6a58] hover:text-[#1a1410]"}`}>
                      {bucket === "All" ? t("shop.all_capacities", "All Capacities") : bucket}
                    </button>
                  ))}
                </div>
              )}

              {hasFilters && (
                <div className="mt-3 flex items-center justify-between text-xs text-[#7a6a58]">
                  <span>{t("shop.showing_count", "Showing")} {filteredProducts.length} {t("shop.products", "products")}</span>
                  <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 font-semibold text-[#cf5427] hover:underline">
                    <X size={13} /> {t("shop.clear_filters", "Clear filters")}
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-80 animate-pulse rounded-3xl bg-white/80 p-4" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm font-medium text-red-700">{error}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-3xl border border-[#3a2a1e]/10 bg-white p-10 text-center">
                <p className="text-base font-semibold text-[#1a1410]">{t("shop.no_products", "No products matched your filters.")}</p>
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="mt-4 rounded-full bg-[#EB6D3D] px-5 py-2 text-xs font-bold text-white hover:bg-[#cf5427]">
                    {t("shop.clear_filters", "Clear filters")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                {filteredProducts.map((product, idx) => {
                  const img = product.images[0] || null;
                  const effective = getEffectivePrice(product);
                  const discounted = effective < product.price;
                  const isTempOut = product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
                  const outOfStock = product.stock < 1 || isTempOut;
                  const fb = cartFeedback?.productId === product.id ? cartFeedback : null;

                  return (
                    <article key={product.id} className="group flex flex-col overflow-hidden rounded-3xl border border-[#3a2a1e]/10 bg-white shadow-[0_12px_30px_rgba(58,42,30,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(58,42,30,.10)]">
                      <Link href={`/products/${encodeURIComponent(product.slug || product.id)}`} className="relative aspect-square overflow-hidden bg-[#2a1f18]">
                        <ProductImage src={img} videoUrl={product.videoUrl} alt={product.name} priority={idx < 3} />
                        {product.badge && (
                          <span className="absolute left-3 top-3 rounded-full bg-[#EB6D3D] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                            {product.badge}
                          </span>
                        )}
                        {product.videoUrl && (
                          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                            <Video size={11} /> Video
                          </span>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b98a3e]">{product.category}</span>
                        <Link href={`/products/${encodeURIComponent(product.slug || product.id)}`} className="mt-1 line-clamp-1 font-serif-heading text-lg font-semibold text-[#1a1410] hover:text-[#cf5427]">
                          {product.name}
                        </Link>
                        {product.description && <p className="mt-1 line-clamp-2 text-xs text-[#7a6a58]">{product.description}</p>}

                        {(product.rewards || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(product.rewards || []).slice(0, 2).map((r) => (
                              <span key={r.id} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                {rewardBadgeText(r)}
                              </span>
                            ))}
                          </div>
                        )}

                        <ProductCountdown stock={product.stock} availableAt={product.availableAt} restockDate={product.restockDate} saleEndDate={product.saleEndDate} />

                        <div className="mt-auto pt-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-[#1a1410]">{formatMoney(effective, product.currency)}</span>
                            {discounted && <span className="text-xs text-[#7a6a58] line-through">{formatMoney(product.price, product.currency)}</span>}
                            <span className="text-[11px] text-[#7a6a58]">/ {product.unit}</span>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={outOfStock}
                              onClick={() => addToCart(product, img)}
                              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${outOfStock ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-[#20283a] text-white hover:bg-[#30384f]"}`}
                            >
                              <ShoppingCart size={13} />
                              <span>{isTempOut ? t("product.out_of_stock_temp", "Temp out") : outOfStock ? t("product.out_of_stock", "Out") : t("checkout.add", "Add")}</span>
                            </button>
                            <Link href={`/products/${encodeURIComponent(product.slug || product.id)}`} aria-label={`View ${product.name}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#3a2a1e]/15 bg-[#faf6ee] text-[#1a1410] transition hover:border-[#b98a3e]">
                              <ArrowUpRight size={15} />
                            </Link>
                          </div>

                          {fb && (
                            <p className={`mt-2 text-[11px] font-semibold ${fb.isError ? "text-red-600" : "text-emerald-700"}`}>
                              {fb.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}