// app/page.tsx
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  ChevronRight,
  ShoppingCart,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";

// ============================================================
// Types
// ============================================================
interface CategoryData {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  images?: string[] | null;
  parentId?: string | null;
  _count?: { products?: number };
}

interface ProductData {
  id?: string;
  name?: string;
  image?: string | null;
  images?: string[] | null;
  categoryId?: string | null;
  category?: string | null;
  price?: number | string | null;
  discountPrice?: number | string | null;
}

interface HomeProductData {
  id: string;
  slug?: string;
  name: string;
  description?: string | null;
  image?: string | null;
  images?: string[] | null;
  category?: { name?: string | null } | string | null;
  price: number | string;
  discountPrice?: number | string | null;
  stock?: number | null;
  unitOfMeasurement?: string | null;
}

interface CategoryItem {
  id: string;
  title: string;
  slug: string;
  images: (string | null)[];
  productCount: number;
  minPrice: number | null;
  maxPrice: number | null;
}

// ============================================================
// API base
// ============================================================
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, "");

// ============================================================
// Site assets — files in /public are served from the root
// ============================================================
const HERO_VIDEOS = ["/banners/dreahero.mp4"];
const HERO_POSTER = "/banners/photo.jpg";

// ============================================================
// Mounted detection (server-safe)
// ============================================================
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

// ============================================================
// Image resolver — Cloudinary ONLY
// ============================================================
function resolveImage(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  return null;
}

// ============================================================
// Price helpers
// ============================================================
function effectivePrice(p: ProductData): number | null {
  const raw =
    p.discountPrice != null && Number(p.discountPrice) > 0
      ? p.discountPrice
      : p.price;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatPrice(n: number): string {
  return `ETB ${n.toLocaleString()}`;
}

// ============================================================
// Build category card data (mosaic + stats)
// ============================================================
function buildCategoryData(
  cat: CategoryData,
  productsForCategory: ProductData[]
): {
  images: (string | null)[];
  productCount: number;
  minPrice: number | null;
  maxPrice: number | null;
} {
  const seen = new Set<string>();
  const images: string[] = [];

  const addImage = (raw?: string | null) => {
    const url = resolveImage(raw);
    if (!url) return;
    if (seen.has(url)) return;
    seen.add(url);
    images.push(url);
  };

  // 1. Category's own image(s) first
  addImage(cat.image);
  if (Array.isArray(cat.images)) {
    for (const img of cat.images) {
      if (images.length >= 4) break;
      addImage(img);
    }
  }

  // 2. Fall back to product images
  for (const p of productsForCategory) {
    if (images.length >= 4) break;
    if (Array.isArray(p.images)) {
      for (const img of p.images) {
        if (images.length >= 4) break;
        addImage(img);
      }
    }
    addImage(p.image);
  }

  // 3. Compute stats
  const prices = productsForCategory
    .map((p) => effectivePrice(p))
    .filter((n): n is number => n !== null);

  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  // 4. Pad mosaic to exactly 4 cells
  const cells: (string | null)[] = [...images];
  while (cells.length < 4) cells.push(null);

  return {
    images: cells.slice(0, 4),
    productCount: cat._count?.products ?? productsForCategory.length,
    minPrice,
    maxPrice,
  };
}

// ============================================================
// CategoryCard — 2×2 mosaic + stats footer
// ============================================================
function CategoryCard({
  product,
  priceLabel,
  productsLabel,
  fromLabel,
  priority = false,
}: {
  product: CategoryItem;
  priceLabel: string;
  productsLabel: string;
  fromLabel: string;
  priority?: boolean;
}) {
  const cells: (string | null)[] = [...product.images];
  while (cells.length < 4) cells.push(null);

  const hasPrices =
    product.minPrice !== null && product.maxPrice !== null;

  const priceText = !hasPrices
    ? null
    : product.minPrice === product.maxPrice
    ? formatPrice(product.minPrice as number)
    : `${fromLabel} ${formatPrice(product.minPrice as number)}`;

  return (
    <a
      href={`/shop?category=${encodeURIComponent(product.slug)}`}
      className="group relative flex w-full flex-col overflow-hidden rounded-[14px] border border-[#eee6d8] bg-white shadow-[0_2px_10px_rgba(58,42,30,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(58,42,30,0.14)]"
    >
      {/* 2×2 mosaic */}
      <div className="relative grid h-[220px] w-full grid-cols-2 grid-rows-2 gap-[2px] bg-[#eee6d8]">
        {cells.map((src, i) => (
          <div key={i} className="relative overflow-hidden bg-[#f5eee1]">
            {src ? (
              <Image
                src={src}
                alt={`${product.title} ${i + 1}`}
                fill
                sizes="(max-width: 640px) 25vw, 12vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                loading={priority && i === 0 ? "eager" : "lazy"}
                fetchPriority={priority && i === 0 ? "high" : "auto"}
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#f5eee1] text-[10px] font-semibold tracking-wider text-[#b98a3e]/40">
                {product.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer with title, product count, price */}
      <div className="flex items-center justify-between gap-2 border-t border-[#f0e8d8] bg-[#faf6ee] px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[12px] font-semibold leading-tight text-[#2a1f18]">
            {product.title}
          </h3>

          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#7a6a58]">
            {product.productCount > 0 && (
              <span className="truncate">
                {product.productCount} {productsLabel}
              </span>
            )}

            {product.productCount > 0 && priceText && (
              <span className="text-[#7a6a58]/40">·</span>
            )}

            {priceText && (
              <span className="truncate font-semibold text-[#b98a3e]">
                {priceText}
              </span>
            )}

            {product.productCount === 0 && (
              <span className="truncate">{product.slug}</span>
            )}
          </div>
        </div>

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:bg-[#e0a83c] group-hover:text-[#1a1410]">
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </a>
  );
}

// ============================================================
// ProductCards
// ============================================================
function ProductCards() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/categories/public`, {
            cache: "no-store",
          }),
          fetch(`${API_BASE_URL}/api/products?limit=200`, {
            cache: "no-store",
          }).catch(() => null),
        ]);

        if (!catRes.ok) {
          throw new Error(`Categories API returned ${catRes.status}`);
        }

        const catData = await catRes.json();
        const rawCats: CategoryData[] = Array.isArray(catData)
          ? catData
          : catData?.categories || catData?.data || [];

        let rawProducts: ProductData[] = [];
        if (prodRes && prodRes.ok) {
          try {
            const prodData = await prodRes.json();
            rawProducts = Array.isArray(prodData)
              ? prodData
              : prodData?.products || prodData?.data || [];
          } catch {
            rawProducts = [];
          }
        }

        if (!isMounted) return;

        if (!Array.isArray(rawCats) || rawCats.length === 0) {
          setCategories([]);
          return;
        }

        const top = rawCats.filter((c) => !c.parentId);
        const toMap = top.length > 0 ? top : rawCats;

        const mapped: CategoryItem[] = toMap.map((cat, i) => {
          const slug = (cat.slug || cat.id || `category-${i}`)
            .toString()
            .toLowerCase();

          const productsForCategory = rawProducts.filter((p) => {
            const pCat = (p.categoryId || p.category || "")
              .toString()
              .toLowerCase();
            return (
              pCat === slug ||
              pCat === (cat.id || "").toString().toLowerCase()
            );
          });

          const { images, productCount, minPrice, maxPrice } =
            buildCategoryData(cat, productsForCategory);

          return {
            id: cat.id || slug,
            title: cat.name || "Untitled",
            slug,
            images,
            productCount,
            minPrice,
            maxPrice,
          };
        });

        setCategories(mapped);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        if (isMounted) {
          setCategories([]);
          setError(
            err instanceof Error ? err.message : "Failed to load categories"
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const productsLabel = t("home.products_label", "products");
  const fromLabel = t("home.from_label", "From");
  const priceLabel = t("home.price_label", "Price");

  if (loading) {
    return (
      <section
        id="products"
        className="w-full scroll-mt-20 overflow-hidden bg-[#fbf8f1] px-4 py-12 sm:px-6 lg:px-10"
      >
        <div className="w-full">
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold leading-tight text-[#2a1f18]">
              {t("home.featured_title", "Featured Categories")}
            </h2>
            <p className="mt-1 text-[12px] text-[#7a6a58]">
              {t("home.featured_subtitle", "Explore top categories")}
            </p>
          </div>
          <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[270px] w-[220px] shrink-0 animate-pulse snap-start rounded-[14px] bg-gray-200 sm:w-[250px]"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || categories.length === 0) {
    return (
      <section
        id="products"
        className="w-full scroll-mt-20 overflow-hidden bg-[#fbf8f1] px-4 py-12 sm:px-6 lg:px-10"
      >
        <div className="w-full text-center">
          <h2 className="text-[20px] font-semibold leading-tight text-[#2a1f18]">
            {t("home.featured_title", "Featured Categories")}
          </h2>
          <p className="mt-2 text-[13px] text-[#7a6a58]">
            {t(
              "home.no_categories",
              "No categories available yet. Please check back soon."
            )}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="products"
      className="w-full scroll-mt-20 overflow-hidden bg-[#fbf8f1] px-4 py-12 sm:px-6 lg:px-10"
    >
      <div className="w-full">
        <div className="mb-6">
          <h2 className="text-[20px] font-semibold leading-tight text-[#2a1f18] sm:text-[22px]">
            {t("home.featured_title", "Featured Categories")}
          </h2>
          <p className="mt-1 text-[12px] text-[#7a6a58]">
            {t("home.featured_subtitle", "Explore top categories")}
          </p>
        </div>

        <nav
          aria-label={t("home.featured_title", "Featured Categories")}
          className="mb-5 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2"
        >
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/shop?category=${encodeURIComponent(category.slug)}`}
              className="flex min-h-10 min-w-[110px] shrink-0 snap-start items-center justify-center rounded-full border border-[#eee6d8] bg-white px-4 text-center text-xs font-semibold text-[#2a1f18] transition hover:border-[#F47822] hover:text-[#F47822]"
            >
              <span className="line-clamp-1">{category.title}</span>
            </a>
          ))}
        </nav>

        <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {categories.map((product, index) => (
            <div
              key={product.id}
              className="w-[220px] shrink-0 snap-start sm:w-[250px]"
            >
              <CategoryCard
                product={product}
                priceLabel={priceLabel}
                productsLabel={productsLabel}
                fromLabel={fromLabel}
                priority={index === 0}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeProducts() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<HomeProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartFeedback, setCartFeedback] = useState<{
    productId: string;
    message: string;
    isError: boolean;
  } | null>(null);

  const addToCart = (product: HomeProductData, image: string | null) => {
    try {
      const cart = readCart();
      const existing = cart.find((item) => item.productId === product.id);
      const nextQuantity = (existing?.quantity || 0) + 1;
      const stock = Number(product.stock) || 0;

      if (nextQuantity > stock) {
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

      const price = Number(product.price) || 0;
      const discountPrice =
        product.discountPrice != null ? Number(product.discountPrice) : null;
      const unitPrice =
        discountPrice !== null && discountPrice > 0 && discountPrice < price
          ? discountPrice
          : price;
      const slug = product.slug || product.id;

      writeCart(
        existing
          ? cart.map((item) =>
              item.productId === product.id
                ? {
                    ...item,
                    name: product.name,
                    slug,
                    image,
                    unitPrice,
                    quantity: nextQuantity,
                  }
                : item
            )
          : [
              ...cart,
              {
                productId: product.id,
                name: product.name,
                slug,
                image,
                unitPrice,
                quantity: 1,
              },
            ]
      );
      setCartFeedback({
        productId: product.id,
        message: t("checkout.added_to_cart", "Added to your order."),
        isError: false,
      });
    } catch (cartError) {
      console.error("Could not save product to the cart:", cartError);
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

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/products/public?limit=24`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error(`Products API returned ${response.status}`);
        }

        const payload: unknown = await response.json();
        const rawProducts: unknown = Array.isArray(payload)
          ? payload
          : payload &&
            typeof payload === "object" &&
            "products" in payload
          ? (payload as { products?: unknown }).products
          : [];

        if (!Array.isArray(rawProducts)) {
          throw new Error("Products API returned an invalid response");
        }

        if (isMounted) {
          setProducts(rawProducts as HomeProductData[]);
        }
      } catch (fetchError) {
        console.error("Failed to fetch home page products:", fetchError);
        if (isMounted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load products"
          );
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

  return (
    <section
      id="featured-products"
      className="scroll-mt-20 bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold leading-tight text-[#2a1f18] sm:text-[22px]">
              {t("home.products_heading_prefix", "Browse our products")}{" "}
              <span className="text-[#F47822]">
                {t("home.products_heading_accent", "you will love.")}
              </span>
            </h2>
            <p className="mt-1 text-[12px] text-[#7a6a58]">
              {t("home.products_subtitle", "Explore our latest products.")}
            </p>
          </div>
          <Link
            href="/shop"
            className="shrink-0 text-xs font-semibold text-[#F47822] hover:underline"
          >
            {t("nav.view_all", "View all products")} <ArrowRight size={14} className="ml-1 inline" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => (
              <div
                key={index}
                className="animate-pulse overflow-hidden rounded-2xl border border-[#eee6d8] bg-white p-2.5"
              >
                <div className="aspect-square rounded-xl bg-gray-200" />
                <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl bg-[#faf6ee] px-4 py-6 text-center text-sm text-[#7a6a58]">
            {t("home.products_load_error", "Products could not be loaded right now. Please try again later.")}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-xl bg-[#faf6ee] px-4 py-6 text-center text-sm text-[#7a6a58]">
            {t("home.no_products", "No products are available yet. Please check back soon.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {products.map((product, index) => {
              const price = Number(product.price) || 0;
              const discountPrice =
                product.discountPrice != null
                  ? Number(product.discountPrice)
                  : null;
              const hasDiscount =
                discountPrice !== null &&
                discountPrice > 0 &&
                discountPrice < price;
              const image =
                (Array.isArray(product.images)
                  ? product.images.map(resolveImage).find(Boolean)
                  : null) || resolveImage(product.image);
              const category =
                typeof product.category === "string"
                  ? product.category
                  : product.category?.name;

              const isAvailable = Number(product.stock) > 0;

              return (
                <div
                  key={product.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#eee6d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <Link
                    href={`/shop/${encodeURIComponent(product.slug || product.id)}`}
                    className="group flex flex-1 flex-col"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#faf6ee]">
                      {image ? (
                        <Image
                          src={image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          loading={index < 2 ? "eager" : "lazy"}
                          fetchPriority={index < 2 ? "high" : "auto"}
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm font-semibold text-[#b98a3e]">
                          {product.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {category && (
                        <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#2a1f18]">
                          {category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="line-clamp-2 min-h-10 text-center text-sm font-semibold text-[#2a1f18] group-hover:text-[#F47822]">
                        {product.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-center text-xs leading-relaxed text-[#7a6a58]">
                        {product.description?.trim() ||
                          t(
                            "shop.default_card_desc",
                            "Explore product details and discover useful finds for everyday life."
                          )}
                      </p>
                      <div className="mt-2 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-center">
                        <span className="text-sm font-bold text-[#2a1f18]">
                          ETB {(hasDiscount ? discountPrice : price).toLocaleString()}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-gray-400 line-through">
                            ETB {price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="px-3 pb-3">
                    <button
                      type="button"
                      onClick={() => addToCart(product, image)}
                      disabled={!isAvailable}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#20283a] px-3 text-xs font-bold text-white transition hover:bg-[#30384f] disabled:cursor-not-allowed disabled:opacity-50"
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
        )}
      </div>
    </section>
  );
}

// ============================================================
// Eyebrow
// ============================================================
function Eyebrow({
  children,
  light = false,
}: {
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      className={`mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] ${
        light ? "text-[#f0c872]" : "text-[#b98a3e]"
      }`}
    >
      <span className="h-px w-5 bg-current" />
      {children}
    </div>
  );
}

// ============================================================
// HomePage
// ============================================================
export default function HomePage() {
  const [showBackTop, setShowBackTop] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mounted = useMounted();
  const { settings } = useSettings();
  const { t } = useLanguage();

  const DEFAULT_PHONE = "+251 993 132 122";
  const DEFAULT_EMAIL = "info@alemayehplastic.com";

  const contactPhone = mounted
    ? settings?.contactPhone || DEFAULT_PHONE
    : DEFAULT_PHONE;
  const contactEmail = mounted
    ? settings?.contactEmail || DEFAULT_EMAIL
    : DEFAULT_EMAIL;
  const cleanPhone = contactPhone.replace(/\s/g, "");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;

    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    };

    tryPlay();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") tryPlay();
      else video.pause();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [heroVideoIndex, videoFailed]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackTop(window.scrollY > 500);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="home-theme overflow-hidden bg-[var(--cream)] text-[var(--ink)]">
      {/* HERO */}
      <section
        id="home"
        className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#1a1410] text-white"
      >
        <div className="absolute inset-0 z-0">
          {videoFailed ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${HERO_POSTER}')` }}
            />
          ) : (
            <video
              ref={videoRef}
              key={HERO_VIDEOS[heroVideoIndex]}
              src={HERO_VIDEOS[heroVideoIndex]}
              poster={HERO_POSTER}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              onEnded={() =>
                setHeroVideoIndex((index) => (index + 1) % HERO_VIDEOS.length)
              }
              onError={() => {
                if (heroVideoIndex < HERO_VIDEOS.length - 1) {
                  setHeroVideoIndex((index) => index + 1);
                } else {
                  setVideoFailed(true);
                }
              }}
            />
          )}
        </div>

        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(90deg, rgba(26,20,16,.72) 0%, rgba(26,20,16,.48) 45%, rgba(26,20,16,.18) 100%)",
          }}
        />
        <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_72%_48%,rgba(224,168,60,.18),transparent_28%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[140px] bg-gradient-to-b from-black/50 to-transparent" />

        <div className="relative z-10 mx-auto flex w-[min(1180px,calc(100%-48px))] justify-center pb-[72px] pt-[110px]">
          <div className="flex max-w-[620px] flex-col items-center text-center animate-fade-in-up">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#EB6D3D]/40 bg-[#2a1f18]/70 px-3.5 py-1.5 text-[10px] font-semibold tracking-[0.16em] text-[#F47822] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#EB6D3D]" />
              {t("home.hero_badge", "YOUR DIGITAL MARKETPLACE")}
            </div>

            <h1 className="mb-5 max-w-[760px] text-[clamp(34px,4.2vw,56px)] font-bold leading-[1.1] tracking-[-0.02em] text-[#faf6ee]">
              {t("home.hero_title_prefix", "Dream More")}
              <span className="mt-2 block text-[clamp(22px,3vw,38px)] font-semibold tracking-[-0.01em] text-[#F47822]">
                {t(
                  "home.hero_title_accent",
                  "Affiliate Market & Article Platform"
                )}
              </span>
            </h1>

            <p className="mb-7 max-w-[540px] text-[14px] leading-[1.75] text-white/80">
              {t(
                "home.hero_subtitle",
                "Discover products from a range of categories, compare listings, and shop with confidence—all in one convenient digital marketplace."
              )}
            </p>

            <div className="flex items-center justify-center gap-4 max-sm:flex-col max-sm:items-center">
              <Link
                href="/shop"
                className="flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-[#EB6D3D] bg-[#EB6D3D] px-6 text-[13px] font-semibold text-white shadow-[0_10px_26px_rgba(235,109,61,0.32)] transition hover:-translate-y-0.5 hover:bg-[#cf5427] hover:shadow-[0_14px_32px_rgba(235,109,61,0.42)]"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-white/40 bg-white/15 text-[9px]">
                  ✓
                </span>
                {t("home.hero_btn_explore", "Shop Collection")}
              </Link>

              <Link
                href="#contact"
                className="flex min-h-[44px] items-center justify-center gap-2.5 rounded-xl border border-white/25 bg-white/5 px-6 text-[13px] font-semibold text-white backdrop-blur-sm transition hover:border-[#f0c872]/70 hover:bg-white/10"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-white/30 text-[9px]">
                  ✦
                </span>
                {t("home.hero_btn_story", "Custom Order")}
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 text-[10px] tracking-[0.2em] text-white/70 md:flex">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[9px]">
            ◌
          </span>
          {t("home.hero_scroll", "SCROLL TO EXPLORE")}
          <ArrowDown size={14} className="ml-1" />
        </div>
      </section>

      {/* INTRO */}
      <section className="bg-white py-12 sm:py-14">
        <div className="mx-auto grid w-[min(1180px,calc(100%-48px))] grid-cols-[1.1fr_.9fr] items-center gap-10 max-lg:grid-cols-1 max-lg:gap-5">
          <div>
            <Eyebrow>
              {t("home.intro_eyebrow", "A BETTER WAY TO DISCOVER PRODUCTS")}
            </Eyebrow>

            <h2 className="text-[clamp(20px,2.1vw,28px)] font-semibold leading-[1.25] tracking-[-0.015em] text-[#2a1f18]">
              {t("home.intro_heading_prefix", "Good finds")}{" "}
              <em className="font-semibold not-italic text-[#F47822]">
                {t("home.intro_heading_accent", "made easy to find")}
              </em>{" "}
              {t("home.intro_heading_suffix", "for everyday life.")}
            </h2>
          </div>

          <div>
            <p className="mb-3 text-[13px] leading-[1.7] text-[var(--muted)]">
              {t(
                "home.intro_p1",
                "Dream More Affiliate Market brings product discovery online, helping shoppers browse listings, compare details, and connect with sellers from one convenient place."
              )}
            </p>

            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 border-b border-[#EB6D3D] pb-0.5 text-[12px] font-semibold text-[#F47822]"
            >
              {t(
                "home.intro_btn",
                "Learn more about Dream More Affiliate Market"
              )}
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURED CATEGORIES */}
      <ProductCards />

      {/* FEATURED PRODUCTS */}
      <HomeProducts />

      {/* FACILITY SECTION */}
      <section id="facility" className="scroll-mt-20 bg-white py-14 sm:py-16">
        <div className="mx-auto grid w-[min(1180px,calc(100%-48px))] grid-cols-[.95fr_1.05fr] items-center gap-12 max-lg:grid-cols-1 max-lg:gap-8">
          <div className="relative h-[380px] w-full max-lg:h-[320px]">
            <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white">
              <Image
                src="/banners/images.jpeg"
                alt="A team working together"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority={false}
                unoptimized
              />
            </div>

            <div className="absolute bottom-4 left-0 z-10 flex w-[180px] items-center gap-2 rounded-r-xl bg-[#F4753E] p-3 shadow-[0_16px_36px_rgba(58,42,30,.25)] max-sm:bottom-0 max-sm:w-[160px] max-sm:p-2.5">
              <div className="grid">
                <strong className="text-[13px] font-semibold leading-tight text-[#1a1410]">
                  {t("home.facility_title", "Dream More")}
                </strong>
                <small className="mt-0.5 text-[8px] uppercase tracking-wider text-[#1a1410]/80">
                  {t("home.facility_motto", "Right work at right time")}
                </small>
              </div>
            </div>
          </div>

          <div>
            <Eyebrow>{t("home.facility_eyebrow", "SHOP SMARTER ONLINE")}</Eyebrow>

            <h2 className="text-[clamp(20px,2.1vw,28px)] font-semibold leading-[1.25] tracking-[-0.015em] text-[#2a1f18]">
              {t("home.facility_heading_prefix", "Your marketplace")}{" "}
              <em className="font-semibold not-italic text-[#F47822]">
                {t("home.facility_heading_accent", "for everyday discoveries.")}
              </em>
            </h2>

            <p className="mt-4 text-[15px] leading-[1.65] text-[#3a2a1e]">
              {t("home.facility_lead_1", "At")}{" "}
              <strong className="font-semibold">
                {t("home.facility_title", "Dream More Affiliate Market")}
              </strong>
              {t(
                "home.facility_lead_2",
                " connects shoppers with product listings from across the marketplace."
              )}
            </p>

            <p className="mt-3 max-w-[520px] text-[13px] leading-[1.75] text-[var(--muted)]">
              {t(
                "home.facility_body",
                "Browse available products, review the details that matter, and reach out when you need help. Dream More makes discovering and shopping online simple."
              )}
            </p>

            <Link
              href="#contact"
              className="mt-6 inline-flex items-center gap-4 rounded-lg border border-[#EB6D3D] px-4 py-2.5 text-[12px] font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D] hover:text-[#20283a]"
            >
              {t("home.facility_btn", "Explore Products")}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACT CTA */}
      <section
        id="contact"
        className="relative overflow-hidden bg-[#2a1f18] py-14 text-white sm:py-16"
      >
        <div className="pointer-events-none absolute -right-[250px] -top-[270px] h-[700px] w-[700px] rounded-full border border-[rgba(224,168,60,.1)]">
          <div className="absolute inset-[70px] rounded-full border border-[rgba(224,168,60,.08)]" />
        </div>

        <div className="relative mx-auto max-w-[720px] px-6 text-center">
          <h2 className="text-[clamp(22px,2.6vw,32px)] font-semibold leading-[1.2] tracking-[-0.015em] text-white">
            {t("home.cta_heading_prefix", "Ready to discover")}{" "}
            <em className="font-semibold not-italic text-[#F47822]">
              {t("home.cta_heading_accent", "at scale?")}
            </em>
          </h2>

          <p className="mx-auto mt-3 max-w-[480px] text-[13px] leading-[1.75] text-white/65">
            {t(
              "home.cta_subtitle",
              "Explore marketplace listings or contact our team if you have a question. We’re here to help make your shopping experience easier."
            )}
          </p>

          <div className="mt-6 flex justify-center gap-4 max-sm:flex-col max-sm:items-center">
            <Link
              href={`tel:${cleanPhone}`}
              className="flex min-h-[44px] w-[150px] items-center justify-center gap-4 rounded-lg bg-white px-4 text-[12px] font-semibold text-[#2a1f18] transition hover:-translate-y-0.5"
            >
              {t("home.cta_btn_call", "Call Us")}
              <ArrowRight size={15} />
            </Link>

            <Link
              href={`mailto:${contactEmail}`}
              className="flex min-h-[44px] w-[150px] items-center justify-center gap-4 rounded-lg border border-white/35 px-4 text-[12px] font-semibold text-white transition hover:bg-white/10"
            >
              {t("home.cta_btn_email", "Send an Email")}
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* BACK TO TOP */}
      <button
        type="button"
        aria-label={t("home.back_to_top", "Back to top")}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-5 right-5 z-40 grid h-[40px] w-[40px] place-items-center rounded-full bg-[#e0a83c] text-[#1a1410] shadow-lg transition-all duration-300 ${
          showBackTop
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-4 opacity-100"
        }`}
      >
        <ArrowUp size={17} />
      </button>
    </main>
  );
}