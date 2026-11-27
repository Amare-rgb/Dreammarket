"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronRight, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";
import ProductCountdown from "@/components/shop/ProductCountdown";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

interface PriceEntry {
  currency: string;
  amount: number;
}

interface RawPriceEntry {
  currency?: string | null;
  amount?: number | string | null;
}

interface CategoryData {
  id?: string;
  name: string;
  slug?: string;
  parentId?: string | null;
  image?: string | null;
  images?: string[] | null;
  _count?: { products?: number };
}

interface HomeProductData {
  id: string;
  slug?: string;
  name: string;
  description?: string | null;
  image?: string | null;
  images?: string[] | null;
  categoryId?: string | null;
  category?: { id?: string | null; name?: string | null; slug?: string | null } | string | null;
  price?: number | string | null;
  currency?: string | null;
  prices?: RawPriceEntry[] | null;
  discountPrice?: number | string | null;
  discountPrices?: { currency: string; amount: number }[] | null;
  stock?: number | null;
  availabilityStatus?: string | null;
  availableAt?: string | null;
  restockDate?: string | null;
  saleEndDate?: string | null;
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
  priceCurrency: string;
}

function resolveImage(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("res.cloudinary.com/") ? `https://${s}` : null;
}

function getPriceEntries(p: {
  price?: number | string | null;
  currency?: string | null;
  prices?: RawPriceEntry[] | null;
}): PriceEntry[] {
  const fromList = Array.isArray(p.prices)
    ? p.prices
        .map((e) => {
          const amount = Number(e?.amount);
          const currency = typeof e?.currency === "string" && e.currency.trim() ? e.currency.trim().toUpperCase() : null;
          return currency && Number.isFinite(amount) && amount > 0 ? { amount, currency } : null;
        })
        .filter((x): x is PriceEntry => Boolean(x))
    : [];

  if (fromList.length > 0) return fromList;
  const fallback = Number(p.price);
  const currency = typeof p.currency === "string" && p.currency.trim() ? p.currency.trim().toUpperCase() : "ETB";
  return Number.isFinite(fallback) && fallback > 0 ? [{ amount: fallback, currency }] : [];
}

function getDiscountMap(p: HomeProductData, fallbackCurrency: string): Map<string, number> {
  const map = new Map<string, number>();
  if (Array.isArray(p.discountPrices)) {
    for (const d of p.discountPrices) {
      if (d && typeof d.currency === "string" && Number(d.amount) > 0) {
        map.set(d.currency.toUpperCase(), Number(d.amount));
      }
    }
  }
  if (map.size === 0 && p.discountPrice != null) {
    const dp = Number(p.discountPrice);
    if (dp > 0) map.set(fallbackCurrency.toUpperCase(), dp);
  }
  return map;
}

function getPrimaryPricing(p: HomeProductData) {
  const entries = getPriceEntries(p);
  const primary = entries.find((e) => e.currency === "ETB") ?? entries[0] ?? { amount: 0, currency: "ETB" };
  const discountMap = getDiscountMap(p, primary.currency);
  const disc = discountMap.get(primary.currency.toUpperCase());
  const hasDiscount = disc != null && disc > 0 && disc < primary.amount;
  const effectivePrice = hasDiscount ? disc : primary.amount;
  const otherPrices = entries.filter((e) => e.currency !== primary.currency);
  return { primary, effectivePrice, hasDiscount, otherPrices, discountMap };
}

function buildCategoryItem(cat: CategoryData, matchedProducts: HomeProductData[]): CategoryItem {
  const seen = new Set<string>();
  const images: string[] = [];
  const pushImg = (raw?: string | null) => {
    const url = resolveImage(raw);
    if (url && !seen.has(url) && images.length < 4) {
      seen.add(url);
      images.push(url);
    }
  };

  pushImg(cat.image);
  (cat.images || []).forEach(pushImg);
  for (const prod of matchedProducts) {
    (prod.images || []).forEach(pushImg);
    pushImg(prod.image);
    if (images.length >= 4) break;
  }

  const prices = matchedProducts
    .map((p) => {
      const { primary, effectivePrice } = getPrimaryPricing(p);
      return primary.amount > 0 ? { amount: effectivePrice, currency: primary.currency } : null;
    })
    .filter((x): x is PriceEntry => Boolean(x));

  const minEntry = prices.length ? prices.reduce((a, b) => (b.amount < a.amount ? b : a)) : null;
  const maxEntry = prices.length ? prices.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;

  const cells: (string | null)[] = [...images];
  while (cells.length < 4) cells.push(null);

  const slug = (cat.slug || cat.id || cat.name).toString().toLowerCase();
  return {
    id: cat.id || slug,
    title: cat.name || "Untitled",
    slug,
    images: cells.slice(0, 4),
    productCount: cat._count?.products ?? matchedProducts.length,
    minPrice: minEntry?.amount ?? null,
    maxPrice: maxEntry?.amount ?? null,
    priceCurrency: minEntry?.currency || maxEntry?.currency || "ETB",
  };
}

function CategoryCard({
  category,
  productsLabel,
  fromLabel,
  priority = false,
}: {
  category: CategoryItem;
  productsLabel: string;
  fromLabel: string;
  priority?: boolean;
}) {
  const hasRange = category.minPrice !== null && category.maxPrice !== null;
  const priceText = !hasRange
    ? null
    : category.minPrice === category.maxPrice
    ? `${category.priceCurrency} ${category.minPrice!.toLocaleString()}`
    : `${fromLabel} ${category.priceCurrency} ${category.minPrice!.toLocaleString()}`;

  return (
    <Link
      href={`/shop?category=${encodeURIComponent(category.slug)}`}
      className="group relative flex w-full flex-col overflow-hidden rounded-[14px] border border-[#eee6d8] bg-white shadow-[0_2px_10px_rgba(58,42,30,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(58,42,30,0.14)]"
    >
      <div className="relative grid h-[220px] w-full grid-cols-2 grid-rows-2 gap-[2px] bg-[#eee6d8]">
        {category.images.map((src, idx) => (
          <div key={idx} className="relative overflow-hidden bg-[#f5eee1]">
            {src ? (
              <Image
                src={src}
                alt={`${category.title} ${idx + 1}`}
                fill
                sizes="(max-width: 640px) 25vw, 12vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                loading={priority && idx === 0 ? "eager" : "lazy"}
                fetchPriority={priority && idx === 0 ? "high" : "auto"}
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#f5eee1] text-[10px] font-semibold tracking-wider text-[#b98a3e]/40">
                {category.title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#f0e8d8] bg-[#faf6ee] px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[12px] font-semibold leading-tight text-[#2a1f18]">{category.title}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#7a6a58]">
            {category.productCount > 0 && <span className="truncate">{category.productCount} {productsLabel}</span>}
            {category.productCount > 0 && priceText && <span className="text-[#7a6a58]/40">·</span>}
            {priceText && <span className="truncate font-semibold text-[#b98a3e]">{priceText}</span>}
            {category.productCount === 0 && <span className="truncate">{category.slug}</span>}
          </div>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-white shadow-md transition-all duration-300 group-hover:scale-110 group-hover:bg-[#e0a83c] group-hover:text-[#1a1410]">
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}

export default function HomeStorefront() {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<HomeProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartFeedback, setCartFeedback] = useState<{ productId: string; message: string; isError: boolean } | null>(null);

 useEffect(() => {
    let active = true;

    Promise.all([
      fetch(`${API_BASE_URL}/api/categories/public`, { cache: "no-store" }),
      fetch(`${API_BASE_URL}/api/products/public?limit=200`, { cache: "no-store" }).catch(() => null),
    ])
      .then(async ([catRes, prodRes]) => {
        if (!catRes.ok) throw new Error(`Categories API returned ${catRes.status}`);
        const catPayload = await catRes.json();
        const rawCats: CategoryData[] = Array.isArray(catPayload)
          ? catPayload
          : catPayload?.categories || catPayload?.data || [];

        let rawProducts: HomeProductData[] = [];
        if (prodRes?.ok) {
          const prodPayload = await prodRes.json().catch(() => null);
          rawProducts = Array.isArray(prodPayload)
            ? prodPayload
            : prodPayload?.products || prodPayload?.data || [];
        }
        if (!active) return;

        setError(null);
        setProducts(rawProducts.slice(0, 24));
        const topCats = rawCats.filter((c) => !c.parentId);
        const list = topCats.length > 0 ? topCats : rawCats;

        const mapped = list.map((cat) => {
          const targets = [cat.id, cat.slug, cat.name]
            .map((v) => (v ?? "").toString().trim().toLowerCase())
            .filter(Boolean);
          const matched = rawProducts.filter((p) => {
            const cObj = typeof p.category === "object" && p.category ? p.category : null;
            const candidates = [
              p.categoryId,
              cObj?.id,
              cObj?.slug,
              cObj?.name,
              typeof p.category === "string" ? p.category : null,
            ]
              .map((v) => (v ?? "").toString().trim().toLowerCase())
              .filter(Boolean);
            return candidates.some((c) => targets.includes(c));
          });
          return buildCategoryItem(cat, matched);
        });
        setCategories(mapped);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load storefront data");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);
  const addToCart = (product: HomeProductData, image: string | null) => {
    try {
      const cart = readCart();
      const existing = cart.find((item) => item.productId === product.id);
      const nextQty = (existing?.quantity || 0) + 1;
      const stock = Number(product.stock) || 0;
      if (nextQty > stock) {
        return setCartFeedback({ productId: product.id, message: t("checkout.stock_limit", "There is not enough stock for another item."), isError: true });
      }
      const { effectivePrice } = getPrimaryPricing(product);
      const slug = product.slug || product.id;
      const nextItem = { productId: product.id, name: product.name, slug, image, unitPrice: effectivePrice, quantity: nextQty };
      writeCart(existing ? cart.map((item) => (item.productId === product.id ? nextItem : item)) : [...cart, nextItem]);
      setCartFeedback({ productId: product.id, message: t("checkout.added_to_cart", "Added to your order."), isError: false });
    } catch {
      setCartFeedback({ productId: product.id, message: t("checkout.cart_save_error", "Could not save your order. Please try again."), isError: true });
    }
  };

  const productsLabel = t("home.products_label", "products");
  const fromLabel = t("home.from_label", "From");

  return (
    <>
      <section id="products" className="w-full scroll-mt-20 overflow-hidden bg-[#fbf8f1] px-4 py-12 sm:px-6 lg:px-10">
        <div className="w-full">
          <div className="mb-6">
            <h2 className="text-[20px] font-semibold leading-tight text-[#2a1f18] sm:text-[22px]">
              {t("home.featured_title", "Featured Categories")}
            </h2>
            <p className="mt-1 text-[12px] text-[#7a6a58]">
              {t("home.featured_subtitle", "Explore top categories")}
            </p>
          </div>

          {loading ? (
            <div className="flex w-full gap-4 overflow-x-auto pb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[270px] w-[220px] shrink-0 animate-pulse rounded-[14px] bg-gray-200 sm:w-[250px]" />
              ))}
            </div>
          ) : error || categories.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#7a6a58]">
              {t("home.no_categories", "No categories available yet. Please check back soon.")}
            </p>
          ) : (
            <>
              <nav aria-label={t("home.featured_title", "Featured Categories")} className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/shop?category=${encodeURIComponent(cat.slug)}`}
                    className="flex min-h-10 min-w-[110px] shrink-0 items-center justify-center rounded-full border border-[#eee6d8] bg-white px-4 text-center text-xs font-semibold text-[#2a1f18] transition hover:border-[#F47822] hover:text-[#F47822]"
                  >
                    <span className="line-clamp-1">{cat.title}</span>
                  </Link>
                ))}
              </nav>

              <div className="flex w-full gap-4 overflow-x-auto pb-4">
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="w-[220px] shrink-0 sm:w-[250px]">
                    <CategoryCard category={cat} productsLabel={productsLabel} fromLabel={fromLabel} priority={idx === 0} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="featured-products" className="scroll-mt-20 bg-white px-4 py-12 sm:px-6 sm:py-14 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[20px] font-semibold leading-tight text-[#2a1f18] sm:text-[22px]">
                {t("home.products_heading_prefix", "Browse our products")}{" "}
                <span className="text-[#F47822]">{t("home.products_heading_accent", "you will love.")}</span>
              </h2>
              <p className="mt-1 text-[12px] text-[#7a6a58]">
                {t("home.products_subtitle", "Explore our latest products.")}
              </p>
            </div>
            <Link href="/shop" className="shrink-0 text-xs font-semibold text-[#F47822] hover:underline">
              {t("nav.view_all", "View all products")} <ArrowRight size={14} className="ml-1 inline" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }, (_, idx) => (
                <div key={idx} className="animate-pulse overflow-hidden rounded-2xl border border-[#eee6d8] bg-white p-2.5">
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
                const { primary, effectivePrice, hasDiscount, otherPrices, discountMap } = getPrimaryPricing(product);
                const image = (Array.isArray(product.images) ? product.images.map(resolveImage).find(Boolean) : null) || resolveImage(product.image);
                const categoryName = typeof product.category === "string" ? product.category : product.category?.name;
                const isTempOut = product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
                const isAvailable = Number(product.stock) > 0 && !isTempOut;
                const fb = cartFeedback?.productId === product.id ? cartFeedback : null;

                return (
                  <div key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#eee6d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                    <Link href={`/shop/${encodeURIComponent(product.slug || product.id)}`} className="group flex flex-1 flex-col">
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
                        {categoryName && (
                          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#2a1f18]">
                            {categoryName}
                          </span>
                        )}
                        {!isAvailable && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#1a1410]/55 backdrop-blur-[1px]">
                            <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1a1410] shadow-lg">
                              {isTempOut ? t("shop.out_of_stock_temp", "Out of stock temporarily") : t("shop.out_of_stock", "Out of stock")}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="line-clamp-2 min-h-10 text-center text-sm font-semibold text-[#2a1f18] group-hover:text-[#F47822]">
                          {product.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-center text-xs leading-relaxed text-[#7a6a58]">
                          {product.description?.trim() || t("shop.default_card_desc", "Explore product details and discover useful finds for everyday life.")}
                        </p>

                        <div className="mt-2 flex flex-col items-center gap-1 text-center">
                          <span className="text-sm font-bold text-[#2a1f18]">
                            {primary.currency} {primary.amount.toLocaleString()}
                          </span>
                          {hasDiscount && (
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                                {primary.currency} {effectivePrice.toLocaleString()} disc
                              </span>
                              <span className="text-[10px] font-semibold text-red-600">
                                Save {primary.currency} {(primary.amount - effectivePrice).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {otherPrices.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {otherPrices.map((entry) => {
                              const entryDisc = discountMap.get(entry.currency.toUpperCase());
                              const hasEntryDisc = entryDisc != null && entryDisc > 0 && entryDisc < entry.amount;
                              return (
                                <div key={entry.currency} className="flex flex-col items-center gap-0.5 text-[10px] text-[#7a6a58]">
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold uppercase tracking-wide">{entry.currency}</span>
                                    <span className="font-semibold">{entry.currency} {entry.amount.toLocaleString()}</span>
                                  </div>
                                  {hasEntryDisc && (
                                    <span className="text-[9px] font-semibold text-red-600">
                                      Save {entry.currency} {(entry.amount - entryDisc!).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <ProductCountdown
                          stock={Number(product.stock) || 0}
                          availableAt={product.availableAt}
                          restockDate={product.restockDate}
                          saleEndDate={product.saleEndDate}
                        />
                      </div>
                    </Link>

                    <div className="border-t border-[#f0e8d8] p-2.5">
                      <button
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => addToCart(product, image)}
                        className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${
                          isAvailable ? "bg-[#20283a] text-white hover:bg-[#30384f]" : "cursor-not-allowed bg-slate-200 text-slate-500"
                        }`}
                      >
                        <ShoppingCart size={13} />
                        <span>{t("checkout.add", "Add")}</span>
                      </button>
                      {fb && (
                        <p className={`mt-1.5 text-center text-[10px] font-semibold ${fb.isError ? "text-red-600" : "text-emerald-700"}`}>
                          {fb.message}
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
    </>
  );
}