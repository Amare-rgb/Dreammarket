// components/shop/Products.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Search, ShoppingCart, Video, X, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductPrice {
  currency: string;
  amount: number;
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
  unit: string;
  stock: number;
  featured?: boolean;
  badge?: string;
  images: string[];
  videoUrl: string | null;
  liters?: number | null;
}

type SortOption = "size-low" | "size-high" | "price-low" | "price-high" | "name";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

interface ApiPrice {
  currency?: string;
  amount?: number | string;
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
  prices?: ApiPrice[] | null;
  discountPrice?: number | string | null;
  unitOfMeasurement?: string | null;
  stock?: number | null;
  isFeatured?: boolean;
  images?: string[] | null;
  videoUrl?: string | null;
  video?: string | null;
  liters?: number | string | null;
  volume?: number | string | null;
  size?: string | null;
  capacity?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API base
// ─────────────────────────────────────────────────────────────────────────────
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, "");

const DEFAULT_CURRENCY = "ETB";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatMoney(amount: number, currency: string = DEFAULT_CURRENCY) {
  if (!Number.isFinite(amount)) return `${currency} 0`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function resolveImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
}

function resolveVideo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
}

const isPositive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

function normalizePrices(p: ApiProduct): ProductPrice[] {
  const list: ProductPrice[] = [];

  if (Array.isArray(p.prices)) {
    for (const raw of p.prices) {
      const currency =
        typeof raw?.currency === "string" && raw.currency.trim()
          ? raw.currency.toUpperCase()
          : null;
      const amount = Number(raw?.amount);
      if (currency && isPositive(amount)) {
        list.push({ currency, amount });
      }
    }
  }

  if (list.length === 0) {
    const amount = Number(p.price);
    const currency =
      typeof p.currency === "string" && p.currency.trim()
        ? p.currency.toUpperCase()
        : DEFAULT_CURRENCY;
    list.push({ currency, amount: isPositive(amount) ? amount : 0 });
  }

  const seen = new Set<string>();
  return list.filter((x) => {
    if (seen.has(x.currency)) return false;
    seen.add(x.currency);
    return true;
  });
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
    if (typeof val === "number" && !isNaN(val) && val > 0) return val;
    if (typeof val === "string") {
      const m = val.match(
        /(\d+(?:\.\d+)?)\s*(?:l|lt|ltr|liter|litre|liters|litres)\b/i
      );
      if (m) {
        const n = parseFloat(m[1]);
        return isNaN(n) ? null : n;
      }
    }
    return null;
  };

  const direct = tryParse(product.liters) ?? tryParse(product.volume);
  if (direct) return direct;

  const fromSize = tryParse(product.size) ?? tryParse(product.capacity);
  if (fromSize) return fromSize;

  const haystack = `${product.name || ""} ${product.description || ""}`;
  const m = haystack.match(
    /(\d+(?:\.\d+)?)\s*(?:l|lt|ltr|liter|litre|liters|litres)\b/i
  );
  if (m) {
    const n = parseFloat(m[1]);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

function literBucket(liters: number): string {
  if (liters < 1) return "Under 1L";
  if (liters <= 1) return "1L";
  if (liters <= 2) return "2L";
  if (liters <= 5) return "5L";
  if (liters <= 10) return "10L";
  if (liters <= 20) return "20L";
  if (liters <= 25) return "25L";
  if (liters <= 30) return "30L";
  if (liters <= 50) return "50L";
  if (liters <= 100) return "100L";
  if (liters <= 200) return "200L";
  if (liters <= 1000) return "1000L (IBC)";
  return "Over 1000L";
}

function parseBucketValue(label: string): number {
  if (label === "Under 1L") return 0.5;
  if (label === "Over 1000L") return 99999;
  const m = label.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function PackageIcon({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m3.3 7 8.7 5 8.7-5M12 22V12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ProductImage: React.FC<{
  src: string | null;
  videoUrl?: string | null;
  alt: string;
  priority?: boolean;
}> = ({ src, videoUrl, alt, priority = false }) => {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const showVideo = Boolean(videoUrl) && hovering && !hasError;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showVideo) {
      v.muted = true;
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
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
        <PackageIcon />
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => videoUrl && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={() => videoUrl && setHovering(true)}
    >
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className={`object-cover object-center transition-all duration-500 ease-out ${
          showVideo ? "opacity-0" : "opacity-100 group-hover:scale-[1.04]"
        }`}
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
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            showVideo ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default function Products() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialCategoryParam = searchParams.get("category") || "All";

  const hasInitializedFromURL = useRef(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ FIX: Initialize state directly reading localStorage, no useEffect needed
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const userData = localStorage.getItem("user") || sessionStorage.getItem("user");
    if (!userData) return false;
    try {
      const parsed = JSON.parse(userData);
      return String(parsed?.role || "").toUpperCase() === "ADMIN";
    } catch {
      return false;
    }
  });

  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] =
    useState<string>(initialCategoryParam);
  const [selectedLiter, setSelectedLiter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("size-low");
  const [cartFeedback, setCartFeedback] = useState<{
    productId: string;
    message: string;
    isError: boolean;
  } | null>(null);

  const addToCart = (product: Product, image: string | null) => {
    try {
      const cart = readCart();
      const existing = cart.find((item) => item.productId === product.id);
      const nextQuantity = (existing?.quantity || 0) + 1;

      if (nextQuantity > product.stock) {
        setCartFeedback({
          productId: product.id,
          message: t(
            "checkout.stock_limit",
            "There is not enough stock for another item."
          ),
          isError: true,
        });
        return;
      }

      const effectivePrice =
        product.discountPrice != null &&
        product.discountPrice > 0 &&
        product.discountPrice < product.price
          ? product.discountPrice
          : product.price;

      const nextCart = existing
        ? cart.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  name: product.name,
                  slug: product.slug,
                  image,
                  unitPrice: effectivePrice,
                  quantity: nextQuantity,
                }
              : item
          )
        : [
            ...cart,
            {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              image,
              unitPrice: effectivePrice,
              quantity: 1,
            },
          ];

      writeCart(nextCart);
      setCartFeedback({
        productId: product.id,
        message: t("checkout.added_to_cart", "Added to your order."),
        isError: false,
      });
    } catch (err) {
      console.error("Could not save product to the cart:", err);
      setCartFeedback({
        productId: product.id,
        message: t(
          "checkout.cart_save_error",
          "Could not save your order. Please try again."
        ),
        isError: true,
      });
    }
  };

  const getCategoryLabel = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower === "all") return t("shop.category_all", "All");
    return catName;
  };

  // ✅ Handle Category Delete
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) return;

    setDeletingCatId(categoryId);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/categories/${categoryId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete category");
      }

      setCategoriesList((prev) => prev.filter((c) => c.id !== categoryId));
      if (selectedCategory.toLowerCase() === categoryName.toLowerCase()) {
        setSelectedCategory("All");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeletingCatId(null);
    }
  };

  // ── Sync category from URL once ────────────────────────────────────────
  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat && cat !== selectedCategory && !hasInitializedFromURL.current) {
      hasInitializedFromURL.current = true;
      setSelectedCategory(cat);
    }
  }, [searchParams, selectedCategory]);

  // ── Load categories ────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/categories/public`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.categories || [];
          if (isMounted && list.length > 0) {
            const top = list.filter((c: CategoryOption) => !c.parentId);
            const items = (top.length > 0 ? top : list).map(
              (c: CategoryOption) => ({
                id: c.id,
                name: c.name,
                slug: c.slug || c.name.toLowerCase(),
                parentId: c.parentId || null,
              })
            );
            setCategoriesList(items);
          }
        }
      } catch (err) {
        console.warn("Could not fetch categories list from backend:", err);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Load products ──────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE_URL}/api/products/public?limit=50`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const data = await res.json();
        const rawProducts: unknown = Array.isArray(data)
          ? data
          : data && typeof data === "object" && "products" in data
          ? (data as { products?: unknown }).products
          : [];

        if (!isMounted) return;

        if (Array.isArray(rawProducts) && rawProducts.length > 0) {
          const mapped: Product[] = (rawProducts as ApiProduct[]).map((p) => {
            const categoryName =
              p.category?.name || p.categoryName || "Other Products";

            const imageList: string[] = Array.isArray(p.images)
              ? p.images
                  .map((img) => resolveImage(img))
                  .filter((u): u is string => Boolean(u))
              : [];

            const videoUrl =
              resolveVideo(p.videoUrl) ?? resolveVideo(p.video);

            const prices = normalizePrices(p);
            const primary = prices[0];
            const price = primary.amount;
            const currency = primary.currency;

            const hasDiscount =
              p.discountPrice !== null &&
              p.discountPrice !== undefined &&
              Number(p.discountPrice) > 0 &&
              Number(p.discountPrice) < price;
            const discountPrice = hasDiscount ? Number(p.discountPrice) : null;

            const stock =
              typeof p.stock === "number" && p.stock >= 0 ? p.stock : 0;

            const liters = detectLiters({
              name: p.name,
              description: p.description || "",
              liters: p.liters,
              volume: p.volume,
              size: p.size,
              capacity: p.capacity,
            });

            return {
              id: p.id ?? p._id ?? "",
              slug: p.slug || p.id || p._id || "",
              name: p.name,
              category: categoryName,
              description: p.description || "",
              price,
              currency,
              prices,
              discountPrice,
              unit: p.unitOfMeasurement || "pcs",
              stock,
              featured: hasDiscount || Boolean(p.isFeatured),
              badge: hasDiscount ? "Sale" : undefined,
              images: imageList,
              videoUrl,
              liters,
            };
          });
          setProducts(mapped);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.warn("Backend products fetch error:", err);
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load products"
          );
          setProducts([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Liter tabs ─────────────────────────────────────────────────────────
  const literTabs = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.liters && p.liters > 0) {
        set.add(literBucket(p.liters));
      }
    });

    const sorted = Array.from(set).sort(
      (a, b) => parseBucketValue(a) - parseBucketValue(b)
    );

    return sorted.length > 0 ? ["All", ...sorted] : [];
  }, [products]);

  // ── Category tabs ──────────────────────────────────────────────────────
  const categoryTabs = useMemo(() => {
    const set = new Set<string>(["All"]);
    categoriesList.forEach((c) => set.add(c.name));
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [categoriesList, products]);

  // ── Filtered + sorted ──────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    const normalizedCategory = selectedCategory.toLowerCase().trim();

    const filtered = products.filter((product) => {
      const productCat = (product.category || "").toLowerCase().trim();
      const matchesCategory =
        normalizedCategory === "all" ||
        productCat === normalizedCategory ||
        productCat.includes(normalizedCategory) ||
        normalizedCategory.includes(productCat);

      const matchesLiter =
        selectedLiter === "All" ||
        (product.liters != null &&
          product.liters > 0 &&
          literBucket(product.liters) === selectedLiter);

      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesLiter && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const priceA = a.discountPrice ?? a.price;
      const priceB = b.discountPrice ?? b.price;

      const litersA = a.liters ?? Number.POSITIVE_INFINITY;
      const litersB = b.liters ?? Number.POSITIVE_INFINITY;

      switch (sort) {
        case "size-low":
          return litersA - litersB;
        case "size-high":
          return (b.liters ?? -1) - (a.liters ?? -1);
        case "price-low":
          return priceA - priceB;
        case "price-high":
          return priceB - priceA;
        case "name":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [products, selectedCategory, selectedLiter, search, sort]);

  const hasActiveFilters =
    selectedCategory.toLowerCase() !== "all" ||
    selectedLiter !== "All" ||
    search.trim() !== "";

  return (
    <main className="shop-theme min-h-screen bg-[var(--cream)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#1a1410] px-5 pb-16 pt-28 sm:px-8 lg:px-12 lg:pb-20 lg:pt-36">
        <div
          className="pointer-events-none absolute -right-24 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#e0a83c]/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#b98a3e]/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h1 className="font-serif-heading text-5xl font-medium leading-[0.98] tracking-[-0.045em] text-[#faf6ee] sm:text-6xl lg:text-7xl">
              {t("shop.hero_title_1", "Discover more,")}
              <br />
              <span className="text-[#F47822]">
                {t("shop.hero_title_2", "all in one marketplace.")}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[#faf6ee]/75 sm:text-lg">
              {t(
                "shop.hero_subtitle",
                "Browse digital marketplace listings, compare product details, and find useful picks from a range of categories."
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">
          {/* Categories sidebar */}
          <aside className="mb-6 rounded-2xl border border-[#3a2a1e]/10 bg-white p-3 shadow-[0_12px_30px_rgba(58,42,30,.05)] lg:mb-0 lg:h-fit lg:sticky lg:top-24 lg:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#b98a3e]">
                {t("shop.categories", "Categories")}
              </h2>
              {selectedCategory.toLowerCase() !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory("All")}
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a6a58] hover:text-[#1a1410]"
                >
                  {t("shop.clear", "Clear")}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {categoryTabs.map((category) => {
                const active =
                  selectedCategory.toLowerCase() === category.toLowerCase();
                  
                // ✅ Find the actual category object to get the ID for deletion
                const categoryObj = categoriesList.find(c => c.name === category);
                const isDeleting = deletingCatId === categoryObj?.id;

                return (
                  <div
                    key={category}
                    className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-[#EB6D3D] text-[#20283a] shadow-md"
                        : "bg-[#faf6ee] text-[#7a6a58] hover:bg-[#f0e8d8] hover:text-[#1a1410]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className="flex-1 text-left truncate"
                    >
                      {getCategoryLabel(category)}
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {/* ✅ Admin Delete Button */}
                      {isAdmin && categoryObj && category !== "All" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCategory(categoryObj.id, categoryObj.name);
                          }}
                          disabled={isDeleting}
                          className={`p-1 rounded-md transition-colors ${
                            active
                              ? "hover:bg-[#20283a]/20 text-[#20283a]"
                              : "hover:bg-red-100 text-red-500 opacity-0 group-hover:opacity-100"
                          }`}
                          title="Delete Category"
                        >
                          {isDeleting ? (
                            <div className={`w-3 h-3 border-2 ${active ? "border-[#20283a]" : "border-red-500"} border-t-transparent rounded-full animate-spin`} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                      
                      <span
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          active
                            ? "bg-[#20283a] text-white"
                            : "bg-white text-[#7a6a58]"
                        }`}
                      >
                        {products.filter((product) => {
                          const productCat = (product.category || "")
                            .toLowerCase()
                            .trim();
                          const normalized = category.toLowerCase();
                          return (
                            normalized === "all" ||
                            productCat === normalized ||
                            productCat.includes(normalized) ||
                            normalized.includes(productCat)
                          );
                        }).length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="min-w-0">
            {/* Controls */}
            <div className="mb-8 rounded-3xl border border-[#3a2a1e]/10 bg-white p-4 shadow-[0_15px_45px_rgba(58,42,30,.06)] sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7a6a58]">
                    <Search size={18} />
                  </div>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t(
                      "shop.search_placeholder",
                      "Search products, categories, and listings..."
                    )}
                    className="h-11 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 pl-11 pr-4 text-sm text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-4 focus:ring-[#e0a83c]/20"
                  />
                </div>

                <div className="flex items-center justify-end">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="h-10 rounded-full border border-[#3a2a1e]/10 bg-[#faf6ee] px-4 text-xs font-semibold text-[#1a1410] outline-none focus:border-[#b98a3e]"
                  >
                    <option value="size-low">
                      {t("shop.sort_size_low", "Size: Small → Large")}
                    </option>
                    <option value="size-high">
                      {t("shop.sort_size_high", "Size: Large → Small")}
                    </option>
                    <option value="price-low">
                      {t("shop.sort_price_low", "Price: Low to High")}
                    </option>
                    <option value="price-high">
                      {t("shop.sort_price_high", "Price: High to Low")}
                    </option>
                    <option value="name">
                      {t("shop.sort_name", "Name A–Z")}
                    </option>
                  </select>
                </div>
              </div>

              {literTabs.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-[#3a2a1e]/10 pt-4 sm:flex-row sm:items-center sm:gap-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b98a3e]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e0a83c]" />
                    {t("shop.filter_by_size", "Filter by Size")}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {literTabs.map((liter) => {
                      const active = selectedLiter === liter;
                      return (
                        <button
                          key={liter}
                          type="button"
                          onClick={() => setSelectedLiter(liter)}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all duration-200 ${
                            active
                              ? "bg-[#EB6D3D] text-[#20283a] shadow-md"
                              : "bg-[#faf6ee] text-[#7a6a58] hover:bg-[#f0e8d8] hover:text-[#1a1410]"
                          }`}
                        >
                          {liter === "All"
                            ? t("shop.size_all", "All Sizes")
                            : liter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Results summary */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[#7a6a58]">
                {t("shop.showing", "Showing")}{" "}
                <span className="font-bold text-[#1a1410]">
                  {filteredProducts.length}
                </span>{" "}
                {filteredProducts.length === 1
                  ? t("shop.product_singular", "product")
                  : t("shop.product_plural", "products")}
                {selectedCategory.toLowerCase() !== "all" && (
                  <span>
                    {" "}
                    {t("shop.in", "in")}{" "}
                    <strong className="text-[#1a1410] capitalize">
                      {getCategoryLabel(selectedCategory)}
                    </strong>
                  </span>
                )}
                {selectedLiter !== "All" && (
                  <span>
                    {" "}
                    · <strong className="text-[#1a1410]">{selectedLiter}</strong>
                  </span>
                )}
              </p>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("All");
                    setSelectedLiter("All");
                    setSearch("");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#b98a3e] hover:underline"
                >
                  <X size={12} />
                  {t("shop.reset_filter", "Reset all filters")}
                </button>
              )}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-2xl border border-[#3a2a1e]/10 bg-white p-2.5 animate-pulse"
                  >
                    <div className="aspect-square w-full rounded-xl bg-gray-200" />
                    <div className="mt-3 space-y-1.5">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-100" />
                      <div className="mt-2 h-5 w-1/2 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product, index) => {
                  const isAboveTheFold = index < 2;

                  const hasDiscount =
                    product.discountPrice != null &&
                    product.discountPrice > 0 &&
                    product.discountPrice < product.price;
                  const displayPrice = hasDiscount
                    ? product.discountPrice!
                    : product.price;

                  const discountPercent = hasDiscount
                    ? Math.round(
                        ((product.price - product.discountPrice!) /
                          product.price) *
                          100
                      )
                    : 0;

                  const otherPrices = product.prices.slice(1);
                  const isAvailable = product.stock > 0;
                  const imageUrl = product.images?.[0] ?? null;
                  const hasVideo = Boolean(product.videoUrl);

                  return (
                    <div
                      key={product.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[#3a2a1e]/10 bg-white shadow-[0_8px_24px_rgba(58,42,30,.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(58,42,30,.12)]"
                    >
                      <Link
                        href={`/shop/${encodeURIComponent(product.slug)}`}
                        className="relative block aspect-square w-full overflow-hidden bg-[#2a1f18]"
                      >
                        <ProductImage
                          src={imageUrl}
                          videoUrl={product.videoUrl}
                          alt={product.name}
                          priority={isAboveTheFold}
                        />

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a1410]/55 via-transparent to-transparent" />

                        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                          <span className="rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1a1410] shadow-sm backdrop-blur">
                            {getCategoryLabel(product.category)}
                          </span>
                          {product.liters != null && product.liters > 0 && (
                            <span className="rounded-full bg-[#1a1410]/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#e0a83c] shadow-sm backdrop-blur">
                              {literBucket(product.liters)}
                            </span>
                          )}
                          {hasDiscount && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                              -{discountPercent}%
                            </span>
                          )}
                          {hasVideo && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EB6D3D] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                              <Video size={10} />
                              Video
                            </span>
                          )}
                        </div>

                        <span className="absolute bottom-2 left-2 rounded-full bg-[#1a1410]/85 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur">
                          {isAvailable
                            ? `${t("shop.in_stock", "In Stock")} (${product.stock})`
                            : t("shop.out_of_stock", "Out of stock")}
                        </span>

                        <span className="absolute bottom-2 right-2 flex h-7 w-7 translate-y-2 items-center justify-center rounded-full bg-[#e0a83c] text-[#1a1410] opacity-0 shadow-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          <ArrowUpRight size={14} strokeWidth={2.4} />
                        </span>
                      </Link>

                      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                        <div>
                          <Link
                            href={`/shop/${encodeURIComponent(product.slug)}`}
                            className="block"
                          >
                            <h2 className="line-clamp-1 text-sm font-bold leading-tight text-[#1a1410] transition-colors group-hover:text-[#b98a3e]">
                              {product.name}
                            </h2>
                          </Link>

                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#7a6a58]">
                            {product.description ||
                              t(
                                "shop.default_card_desc",
                                "Explore product details and discover useful finds for everyday life."
                              )}
                          </p>
                        </div>

                        <div className="mt-2.5 flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-bold text-[#1a1410]">
                              {formatMoney(displayPrice, product.currency)}
                            </span>
                            <span className="text-[10px] text-[#7a6a58]">
                              /{product.unit}
                            </span>
                          </div>
                          {hasDiscount && (
                            <span className="text-[10px] text-gray-400 line-through">
                              {formatMoney(product.price, product.currency)}
                            </span>
                          )}
                        </div>

                        {otherPrices.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {otherPrices.map((p) => (
                              <div
                                key={p.currency}
                                className="flex items-center justify-between text-[10px] text-[#7a6a58]"
                              >
                                <span className="font-semibold uppercase tracking-wide">
                                  {p.currency}
                                </span>
                                <span>{formatMoney(p.amount, p.currency)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => addToCart(product, imageUrl)}
                          disabled={!isAvailable}
                          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#20283a] px-3 text-xs font-bold text-white transition hover:bg-[#30384f] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ShoppingCart size={15} />
                          {t("checkout.add_to_order", "Add to cart")}
                        </button>

                        {cartFeedback?.productId === product.id && (
                          <p
                            role="status"
                            className={`mt-2 text-center text-xs ${
                              cartFeedback.isError
                                ? "text-red-600"
                                : "text-green-700"
                            }`}
                          >
                            {cartFeedback.message}
                            {!cartFeedback.isError && (
                              <>
                                {" "}
                                <Link
                                  href="/checkout"
                                  className="font-semibold underline underline-offset-2"
                                >
                                  {t("checkout.go_to_checkout", "Checkout")}
                                </Link>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[#3a2a1e]/20 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#faf6ee] text-[#b98a3e]">
                  <Search size={22} />
                </div>
                <h3 className="font-serif-heading text-xl font-bold text-[#1a1410]">
                  {t("shop.no_products_title", "No products found")}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#7a6a58]">
                  {t(
                    "shop.no_products_desc",
                    "We couldn't find any items matching your current filters. Try adjusting your search query or choosing another category."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("All");
                    setSelectedLiter("All");
                  }}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#EB6D3D] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#20283a] transition hover:bg-[#cf5427] hover:text-white"
                >
                  {t("shop.clear_filters", "Clear all filters")}
                </button>
              </div>
            )}

            {error && !loading && filteredProducts.length === 0 && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}