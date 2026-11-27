"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Gift, Play } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";
import { getVideoSource } from "@/lib/video";
import ProductCountdown from "./ProductCountdown";
import ProductFeedback from "./ProductFeedback";

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
  sizes?: { size: string; stock: number; sku?: string | null }[];
  rewards?: ProductReward[];
}

const BUSINESS_PHONE = "+251 993 132 122";
const BUSINESS_PHONE_TEL = BUSINESS_PHONE.replace(/\s/g, "");

function formatMoney(amount: number, currency: string): string {
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

function resolveMediaUrl(raw: unknown, allowDataUri: boolean): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (allowDataUri && s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("res.cloudinary.com/") ? `https://${s}` : null;
}

function rewardBadgeText(r: ProductReward): string {
  const cur = r.currency || "ETB";
  const trigger =
    r.triggerType === "MIN_QUANTITY"
      ? `Buy ${Number(r.threshold)}+`
      : `Spend ${Number(r.threshold).toLocaleString()}+ ${cur}`;
  const reward =
    r.rewardType === "PERCENT_DISCOUNT"
      ? `${r.rewardValue}% off`
      : r.rewardType === "FREE_ITEM"
      ? `Free ${r.rewardValue}`
      : `${r.rewardValue} ${cur} reward`;
  return `${trigger} → ${reward}`;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M7 3h2l1.2 4-2 1.5a15 15 0 0 0 7.3 7.3L17 13.8 21 15v2c0 1.1-.9 2-2 2C10.2 19 5 13.8 5 5c0-1.1.9-2 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProductImage({
  src,
  alt,
  className = "",
  priority = false,
  contain = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-[#f5f0e6] text-[#b98a3e]/40 ${className}`}>
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden="true">
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      key={src}
      src={src}
      alt={alt}
      fill
      unoptimized
      className={`${contain ? "object-contain" : "object-cover"} object-center ${className}`}
      onError={() => setFailed(true)}
      sizes="(max-width: 768px) 100vw, 50vw"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}

function ImageLightbox({
  images,
  index,
  alt,
  onClose,
  onSelect,
}: {
  images: string[];
  index: number;
  alt: string;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const count = images.length;
  const safe = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const src = count > 0 ? images[safe] : null;
  const goTo = (next: number) => count > 0 && onSelect(((next % count) + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(safe + 1);
      if (e.key === "ArrowLeft") goTo(safe - 1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, safe, count]);

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95" onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold text-white/70">{safe + 1} / {count}</span>
        <button type="button" onClick={onClose} aria-label="Close fullscreen image" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
          <CloseIcon />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
        <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
          <Image key={src} src={src} alt={alt} fill unoptimized className="object-contain" sizes="100vw" priority />
        </div>
        {count > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); goTo(safe - 1); }} aria-label="Previous image" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); goTo(safe + 1); }} aria-label="Next image" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 pb-4 pt-2" onClick={(e) => e.stopPropagation()}>
          {images.map((image, i) => (
            <button key={`${image}-${i}`} type="button" onClick={() => onSelect(i)} aria-label={`View image ${i + 1}`} className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === safe ? "border-[#F47822] opacity-100" : "border-transparent opacity-60 hover:opacity-100"}`}>
              <Image src={image} alt="" fill unoptimized className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductVideo({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);
  const source = getVideoSource(src);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!source) return null;

  const renderPlayer = (modal = false) =>
    source.kind === "iframe" ? (
      <iframe
        src={source.src}
        title={title}
        loading={modal ? undefined : "lazy"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={modal ? "aspect-video w-full max-w-5xl rounded-lg" : "absolute inset-0 h-full w-full"}
        onClick={modal ? (e) => e.stopPropagation() : undefined}
      />
    ) : (
      <video
        src={source.src}
        controls
        autoPlay={modal}
        playsInline
        preload={modal ? undefined : "metadata"}
        className={modal ? "max-h-[90vh] max-w-[90vw] rounded-lg" : "max-h-[360px] w-full bg-black object-contain"}
        onClick={modal ? (e) => e.stopPropagation() : undefined}
      />
    );

  return (
    <section aria-labelledby="product-video-heading" className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#3a2a1e]/5 sm:p-4">
      <h2 id="product-video-heading" className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b98a3e]">Product Video</h2>
      <div className="relative overflow-hidden rounded-xl bg-black">
        {source.kind === "iframe" ? (
          <div className="relative aspect-video w-full">{renderPlayer(false)}</div>
        ) : source.kind === "file" ? (
          renderPlayer(false)
        ) : (
          <a href={source.src} target="_blank" rel="noopener noreferrer" className="flex aspect-video w-full items-center justify-center gap-2 bg-black/90 text-sm font-semibold text-white transition hover:bg-black">
            <Play className="h-4 w-4" /> Watch video
          </a>
        )}
        {source.kind !== "link" && (
          <button type="button" onClick={() => setOpen(true)} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1a1410] shadow hover:bg-white">
            <Play className="h-3.5 w-3.5" /> Fullscreen
          </button>
        )}
      </div>

      {open && source.kind !== "link" && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={`${title} video`}>
          <button type="button" aria-label="Close video" onClick={() => setOpen(false)} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
            <CloseIcon />
          </button>
          {renderPlayer(true)}
        </div>
      )}
    </section>
  );
}

export default function ProductDetails({ product }: { product: Product }) {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<ProductReward | null>(null);

  const sizeVariants = useMemo(
    () => (product.sizes || []).filter((s) => s && typeof s.size === "string" && s.size.trim() !== ""),
    [product.sizes]
  );
  const hasSizes = sizeVariants.length > 0;
  const activeSize = hasSizes ? sizeVariants.find((s) => s.size === selectedSize) ?? null : null;
  const effectiveStock = activeSize ? activeSize.stock : product.stock;

  const primary = product.prices[0] ?? { currency: product.currency || "ETB", amount: product.price };
  const currency = primary.currency;
  const price = primary.amount;
  const otherPrices = useMemo(() => product.prices.slice(1).filter((p) => p.amount > 0), [product.prices]);

  const discountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (Array.isArray(product.discountPrices)) {
      for (const d of product.discountPrices) {
        if (d && typeof d.currency === "string" && Number(d.amount) > 0) {
          map.set(d.currency.toUpperCase(), Number(d.amount));
        }
      }
    }
    if (map.size === 0 && product.discountPrice != null && product.discountPrice > 0) {
      map.set(currency.toUpperCase(), product.discountPrice);
    }
    return map;
  }, [product.discountPrices, product.discountPrice, currency]);

  const primaryDiscount = discountMap.get(currency.toUpperCase());
  const hasDiscount = primaryDiscount != null && primaryDiscount > 0 && primaryDiscount < price;
  const effectivePrice = hasDiscount ? primaryDiscount : price;

  const images = useMemo(
    () => (Array.isArray(product.images) ? product.images : []).map((img) => resolveMediaUrl(img, true)).filter((u): u is string => Boolean(u)),
    [product.images]
  );
  const videoUrl = useMemo(() => resolveMediaUrl(product.videoUrl, false), [product.videoUrl]);
  const hasImages = images.length > 0;
  const safeIndex = hasImages ? Math.min(Math.max(selectedImage, 0), images.length - 1) : 0;
  const currentImage = hasImages ? images[safeIndex] : null;

  const isTempOut = product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
  const isAvailable = effectiveStock > 0 && !isTempOut;
  const ctaDisabled = !isAvailable || (hasSizes && !selectedSize);
  const ctaLabel =
    hasSizes && !selectedSize
      ? t("product.select_size_first", "Select a size")
      : isTempOut
      ? t("product.out_of_stock_temp", "Out of stock temporarily")
      : effectiveStock < 1
      ? t("product.out_of_stock", "Out of stock")
      : t("checkout.add_to_order", "Add to order");

  const addToCart = () => {
    try {
      const cart = readCart();
      const cartKey = activeSize ? `${product.id}::${activeSize.size}` : product.id;
      const existing = cart.find((item) => item.productId === cartKey);
      const nextQuantity = (existing?.quantity || 0) + 1;
      if (nextQuantity > effectiveStock) {
        return setCartMessage(t("checkout.stock_limit", "There is not enough stock for another item."));
      }
      const displayName = activeSize ? `${product.name} — Size ${activeSize.size}` : product.name;
      const nextItem = { productId: cartKey, name: displayName, slug: product.slug, image: currentImage, unitPrice: effectivePrice, quantity: nextQuantity };
      writeCart(existing ? cart.map((item) => (item.productId === cartKey ? nextItem : item)) : [...cart, nextItem]);
      setCartMessage(t("checkout.added_to_cart", "Added to your order."));
    } catch (error) {
      console.error("Could not save product to the cart:", error);
      setCartMessage(t("checkout.cart_save_error", "Could not save your order. Please try again."));
    }
  };

  return (
    <main className="shop-theme min-h-screen bg-[#efe9e2] text-[#1a1410]">
      <section className="px-4 py-8 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-[#f5f1ea]/95 p-4 shadow-[0_20px_60px_rgba(58,42,30,0.08)] ring-1 ring-[#3a2a1e]/5 sm:p-6 lg:p-8">
          <div className="grid gap-7 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            <div className="space-y-3">
              <button type="button" onClick={() => hasImages && setLightboxOpen(true)} aria-label={t("product.view_fullscreen", "View full image")} disabled={!hasImages} className="group relative mx-auto block w-full max-w-[440px] overflow-hidden rounded-[26px] bg-[#f5f0e6] shadow-[0_12px_30px_rgba(58,42,30,0.08)] disabled:cursor-default">
                <div className="relative aspect-square overflow-hidden rounded-[26px]">
                  <ProductImage src={currentImage} alt={product.name} className="h-full w-full" priority contain />
                  {!isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1a1410]/55 backdrop-blur-[1px]">
                      <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1a1410] shadow-lg">
                        {isTempOut ? t("product.out_of_stock_temp", "Out of stock temporarily") : t("product.out_of_stock", "Currently out of stock")}
                      </span>
                    </div>
                  )}
                  {product.badge && (
                    <span className="absolute left-4 top-4 rounded-full bg-[#faf6ee]/95 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#b98a3e] shadow-sm backdrop-blur">
                      {product.badge === "Special Offer" || product.badge === "Sale" ? t("product.special_offer", "Sale") : product.badge}
                    </span>
                  )}
                  {hasImages && (
                    <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      {t("product.tap_to_zoom", "Tap to zoom")}
                    </span>
                  )}
                </div>
              </button>

              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2.5">
                  {images.map((image, index) => (
                    <button key={`${image}-${index}`} type="button" onClick={() => { setSelectedImage(index); setLightboxOpen(true); }} aria-label={`View image ${index + 1}`} className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-[#f5f0e6] transition-all ${safeIndex === index ? "border-[#b98a3e] shadow-md" : "border-transparent opacity-80 hover:opacity-100"}`}>
                      <ProductImage src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full" contain />
                    </button>
                  ))}
                </div>
              )}

              {videoUrl && (
                <div className="mx-auto w-full max-w-[440px]">
                  <ProductVideo src={videoUrl} title={product.name} />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="rounded-full bg-[#1a1410] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.17em] text-[#e0a83c]">{product.category}</span>
                <span className="text-[11px] font-medium text-[#7a6a58]">{t("product.direct_from_factory", "Marketplace listing")}</span>
              </div>

              <h1 className="font-serif-heading text-left text-3xl font-medium leading-[1.02] tracking-[-0.04em] text-[#1a1410] sm:text-4xl lg:text-[3.2rem]">{product.name}</h1>
              <div className="my-5 h-px bg-[#3a2a1e]/10" />

              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-serif-heading text-3xl font-semibold tracking-[-0.035em] text-[#1a1410] sm:text-[2.75rem]">{formatMoney(price, currency)}</span>
                  <span className="pb-1 text-sm text-[#7a6a58]">{t("product.per", "per")} {product.unit}</span>
                </div>
                {hasDiscount && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{formatMoney(effectivePrice, currency)} disc</span>
                    <span className="text-xs font-semibold text-red-600">Save {formatMoney(price - effectivePrice, currency)}</span>
                  </div>
                )}
              </div>

              {otherPrices.length > 0 && (
                <div className="mt-3 rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee] p-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b98a3e]">{t("product.also_available_in", "Also available in")}</p>
                  <div className="space-y-1">
                    {otherPrices.map((p) => {
                      const disc = discountMap.get(p.currency.toUpperCase());
                      const hasDisc = disc != null && disc > 0 && disc < p.amount;
                      return (
                        <div key={p.currency} className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#7a6a58]">{p.currency}</span>
                            <span className="font-semibold text-[#1a1410]">{formatMoney(p.amount, p.currency)}</span>
                          </div>
                          {hasDisc && (
                            <div className="flex items-center gap-2 pl-4">
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{formatMoney(disc, p.currency)} disc</span>
                              <span className="text-xs font-semibold text-red-600">Save {formatMoney(p.amount - disc, p.currency)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? "bg-emerald-500" : isTempOut ? "bg-amber-500" : "bg-red-500"}`} />
                <span className={isAvailable ? "font-semibold text-emerald-700" : isTempOut ? "font-semibold text-amber-700" : "text-[#7a6a58]"}>
                  {isAvailable ? t("product.available_now", "Available now") : isTempOut ? t("product.out_of_stock_temp", "Out of stock temporarily") : t("product.out_of_stock", "Currently out of stock")}
                </span>
              </div>

              {(product.rewards || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(product.rewards || []).map((r) => (
                    <button key={r.id} type="button" onClick={() => setSelectedReward(r)} className="flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100">
                      <Gift className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{rewardBadgeText(r)}</span>
                      {r.promoCode && <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">{r.promoCode}</span>}
                    </button>
                  ))}
                </div>
              )}

              {selectedReward && (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs text-slate-700">
                  <span><strong>{selectedReward.name}</strong>: {rewardBadgeText(selectedReward)}</span>
                  <button type="button" onClick={() => setSelectedReward(null)} className="font-semibold text-slate-500 hover:text-slate-800">Close</button>
                </div>
              )}

              {hasSizes && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b98a3e]">{t("product.select_size", "Select Size")}</p>
                  <div className="flex flex-wrap gap-2">
                    {sizeVariants.map((s) => {
                      const active = selectedSize === s.size;
                      const out = s.stock < 1;
                      return (
                        <button key={s.size} type="button" onClick={() => setSelectedSize(active ? null : s.size)} disabled={out} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${active ? "border-[#1a1410] bg-[#1a1410] text-white" : out ? "cursor-not-allowed border-[#3a2a1e]/15 bg-[#faf6ee] text-[#7a6a58]/50" : "border-[#3a2a1e]/15 bg-white text-[#1a1410] hover:border-[#b98a3e]"}`}>
                          {s.size} <span className="text-xs opacity-75">({s.stock})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <ProductCountdown stock={effectiveStock} availableAt={product.availableAt} restockDate={product.restockDate} saleEndDate={product.saleEndDate} />

              {product.description && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#5c4d3f]">{product.description}</p>
              )}

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <button type="button" onClick={addToCart} disabled={ctaDisabled} className={`flex-1 flex h-14 items-center justify-center gap-2 rounded-2xl border px-5 text-base font-bold shadow-lg transition ${ctaDisabled ? isTempOut ? "cursor-not-allowed border-amber-300 bg-amber-100 text-amber-800" : "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500" : "border-[#20283a] bg-[#20283a] text-white hover:bg-[#30384f]"}`}>
                  {t("checkout.add_to_order", "Add to order")} · {ctaLabel}
                </button>
                <a href={`tel:${BUSINESS_PHONE_TEL}`} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#3a2a1e]/15 bg-white px-5 text-sm font-bold text-[#1a1410] shadow-sm transition hover:bg-[#faf6ee]">
                  <PhoneIcon />
                  <span>{BUSINESS_PHONE}</span>
                </a>
              </div>

              {cartMessage && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-1.5"><CheckIcon /> {cartMessage}</span>
                  <Link href="/checkout" className="underline">{t("checkout.view_cart", "Checkout")}</Link>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 border-t border-[#3a2a1e]/10 pt-8">
            <ProductFeedback productId={product.id} />
          </div>
        </div>
      </section>

      {lightboxOpen && hasImages && (
        <ImageLightbox images={images} index={safeIndex} alt={product.name} onClose={() => setLightboxOpen(false)} onSelect={setSelectedImage} />
      )}
    </main>
  );
}