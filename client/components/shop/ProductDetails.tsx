// components/shop/ProductDetails.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Play, ChevronLeft, ChevronRight, Gift } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";
import { getVideoSource } from "@/lib/video";
import ProductFeedback from "./ProductFeedback";
import ProductCountdown from "./ProductCountdown";

// ─────────────────────────────────────────────────────────────────────────────
// Types — must match app/shop/[slug]/page.tsx
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
  rewards?: {
    id: string;
    name: string;
    triggerType: string;
    threshold: number;
    rewardType: string;
    rewardValue: string;
    currency?: string | null;
    promoCode: string | null;
    expiresAt?: string | null;
  }[];
}

type ProductDetailsProps = {
  product: Product;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const BUSINESS_PHONE = "+251 993 132 122";
const BUSINESS_PHONE_TEL = BUSINESS_PHONE.replace(/\s/g, "");

// ─────────────────────────────────────────────────────────────────────────────
// Formatters / resolvers
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5M11 8v6M8 11h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function rewardBadgeText(r: {
  triggerType: string;
  threshold: number;
  rewardType: string;
  rewardValue: string;
  currency?: string | null;
}): string {
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

function PackageIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
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

// ─────────────────────────────────────────────────────────────────────────────
// Stable image — fallback to package icon on error
// ─────────────────────────────────────────────────────────────────────────────
const ProductImage: React.FC<{
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  contain?: boolean;
}> = ({ src, alt, className = "", priority = false, contain = false }) => {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-[#f5f0e6] text-[#b98a3e]/40 ${className}`}
      >
        <PackageIcon />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className={`${
        contain ? "object-contain" : "object-cover"
      } object-center ${className}`}
      onError={() => setHasError(true)}
      sizes="(max-width: 768px) 100vw, 50vw"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────
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

  const goTo = (next: number) => {
    if (count === 0) return;
    onSelect(((next % count) + count) % count);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(safe + 1);
      if (e.key === "ArrowLeft") goTo(safe - 1);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, safe, count]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      {/* Top bar — counter + close */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-semibold text-white/70">
          {safe + 1} / {count}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close fullscreen image"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Main image */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2">
        <div
          className="relative h-full w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            key={src}
            src={src}
            alt={alt}
            fill
            unoptimized
            className="object-contain"
            sizes="100vw"
            priority
          />
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goTo(safe - 1);
              }}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goTo(safe + 1);
              }}
              aria-label="Next image"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <div
          className="flex items-center justify-center gap-2 overflow-x-auto px-4 pb-4 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((image, i) => (
            <button
              key={`${image}-${i}`}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === safe
                  ? "border-[#F47822] opacity-100"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={image}
                alt=""
                fill
                unoptimized
                className="object-cover"
                sizes="56px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video section — plays inline + "Fullscreen" lightbox
// ─────────────────────────────────────────────────────────────────────────────
function ProductVideo({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);
  const source = getVideoSource(src);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!source) return null;

  return (
    <section
      aria-labelledby="product-video-heading"
      className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#3a2a1e]/5 sm:p-4"
    >
      <h2
        id="product-video-heading"
        className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#b98a3e]"
      >
        Product Video
      </h2>

      <div className="relative overflow-hidden rounded-xl bg-black">
        {source.kind === "iframe" ? (
          <div className="relative aspect-video w-full">
            <iframe
              src={source.src}
              title={title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : source.kind === "file" ? (
          <video
            src={source.src}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[360px] object-contain bg-black"
          />
        ) : (
          <a
            href={source.src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex aspect-video w-full items-center justify-center gap-2 bg-black/90 text-sm font-semibold text-white transition hover:bg-black"
          >
            <Play className="h-4 w-4" />
            Watch video
          </a>
        )}

        {source.kind !== "link" && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1a1410] shadow hover:bg-white"
          >
            <Play className="h-3.5 w-3.5" />
            Fullscreen
          </button>
        )}
      </div>

      {open && source.kind !== "link" && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} video`}
        >
          <button
            type="button"
            aria-label="Close video"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <CloseIcon />
          </button>
          {source.kind === "iframe" ? (
            <iframe
              src={source.src}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="aspect-video w-full max-w-5xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={source.src}
              controls
              autoPlay
              playsInline
              className="max-h-[90vh] max-w-[90vw] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetails({ product }: ProductDetailsProps) {
  const { t } = useLanguage();

  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<NonNullable<Product["rewards"]>[number] | null>(null);

  const sizeVariants = useMemo(
    () =>
      (product.sizes || []).filter(
        (s) => s && typeof s.size === "string" && s.size.trim() !== ""
      ),
    [product.sizes]
  );
  const hasSizes = sizeVariants.length > 0;
  const activeSize = hasSizes
    ? sizeVariants.find((s) => s.size === selectedSize) ?? null
    : null;
  // Effective stock: per-size stock when a size is selected, else product stock
  const effectiveStock = activeSize ? activeSize.stock : product.stock;

  // Primary price = first row from admin (already normalized on the server page)
  const primary = product.prices[0] ?? {
    currency: product.currency || "ETB",
    amount: product.price,
  };
  const currency = primary.currency;
  const price = primary.amount;

  const otherPrices = useMemo(
    () => product.prices.slice(1).filter((p) => p.amount > 0),
    [product.prices]
  );

  // Build per-currency discount lookup
  const discountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (Array.isArray(product.discountPrices)) {
      for (const d of product.discountPrices) {
        if (d && typeof d.currency === "string" && Number(d.amount) > 0) {
          map.set(d.currency.toUpperCase(), Number(d.amount));
        }
      }
    }
    // Fallback: single discountPrice applies to primary currency only
    if (map.size === 0 && product.discountPrice != null && product.discountPrice > 0) {
      map.set(currency.toUpperCase(), product.discountPrice);
    }
    return map;
  }, [product.discountPrices, product.discountPrice, currency]);

  const primaryDiscount = discountMap.get(currency.toUpperCase());
  const hasDiscount =
    primaryDiscount != null &&
    primaryDiscount > 0 &&
    primaryDiscount < price;

  const effectivePrice = hasDiscount ? (primaryDiscount as number) : price;

  // Cloudinary-only images
  const images = useMemo(() => {
    const raw = Array.isArray(product.images) ? product.images : [];
    return raw
      .map((img) => resolveImage(img))
      .filter((u): u is string => Boolean(u));
  }, [product.images]);

  const videoUrl = useMemo(
    () => resolveVideo(product.videoUrl),
    [product.videoUrl]
  );

  const hasImages = images.length > 0;
  const safeIndex = hasImages
    ? Math.min(Math.max(selectedImage, 0), images.length - 1)
    : 0;
  const currentImage = hasImages ? images[safeIndex] : null;

  const addToCart = () => {
    try {
      const cart = readCart();
      const cartKey = activeSize ? `${product.id}::${activeSize.size}` : product.id;
      const existing = cart.find((item) => item.productId === cartKey);
      const nextQuantity = (existing?.quantity || 0) + 1;
      if (nextQuantity > effectiveStock) {
        setCartMessage(
          t("checkout.stock_limit", "There is not enough stock for another item.")
        );
        return;
      }

      const displayName = activeSize
        ? `${product.name} — Size ${activeSize.size}`
        : product.name;

      if (existing) {
        writeCart(
          cart.map((item) =>
            item.productId === cartKey
              ? {
                  ...item,
                  name: displayName,
                  slug: product.slug,
                  image: currentImage,
                  unitPrice: effectivePrice,
                  quantity: nextQuantity,
                }
              : item
          )
        );
      } else {
        writeCart([
          ...cart,
          {
            productId: cartKey,
            name: displayName,
            slug: product.slug,
            image: currentImage,
            unitPrice: effectivePrice,
            quantity: 1,
          },
        ]);
      }
      setCartMessage(t("checkout.added_to_cart", "Added to your order."));
    } catch (error) {
      console.error("Could not save product to the cart:", error);
      setCartMessage(
        t(
          "checkout.cart_save_error",
          "Could not save your order. Please try again."
        )
      );
    }
  };

  const ctaDisabled =
    effectiveStock < 1 ||
    product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" ||
    (hasSizes && !selectedSize);

  const ctaLabel = hasSizes && !selectedSize
    ? t("product.select_size_first", "Select a size")
    : product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY"
    ? t("product.out_of_stock_temp", "Out of stock temporarily")
    : effectiveStock < 1
    ? t("product.out_of_stock", "Out of stock")
    : t("checkout.add_to_order", "Add to order");

  const ctaButtonClass = `flex h-14 items-center justify-center gap-2 rounded-2xl border px-5 text-base font-bold shadow-lg transition ${
    ctaDisabled
      ? product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY"
        ? "border-amber-300 bg-amber-100 text-amber-800 cursor-not-allowed"
        : "border-slate-300 bg-slate-200 text-slate-500 cursor-not-allowed"
      : "border-[#20283a] bg-[#20283a] text-white hover:bg-[#30384f]"
  }`;

  return (
    <main className="shop-theme min-h-screen bg-[#efe9e2] text-[#1a1410]">
      <section className="px-4 py-8 sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-[#f5f1ea]/95 p-4 shadow-[0_20px_60px_rgba(58,42,30,0.08)] ring-1 ring-[#3a2a1e]/5 sm:p-6 lg:p-8">
          <div className="grid gap-7 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
            {/* ── LEFT COLUMN: Gallery + Video ── */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => hasImages && setLightboxOpen(true)}
                aria-label={t("product.view_fullscreen", "View full image")}
                disabled={!hasImages}
                className="group relative mx-auto block w-full max-w-[440px] overflow-hidden rounded-[26px] bg-[#f5f0e6] shadow-[0_12px_30px_rgba(58,42,30,0.08)] disabled:cursor-default"
              >
                <div className="relative aspect-square overflow-hidden rounded-[26px]">
                  <ProductImage
                    key={currentImage ?? "empty"}
                    src={currentImage}
                    alt={product.name}
                    className="w-full h-full"
                    priority
                    contain
                  />

                  {(() => {
                    const isTempOut =
                      product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
                    const isAvailable = effectiveStock > 0 && !isTempOut;
                    if (isAvailable) return null;
                    return (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#1a1410]/55 backdrop-blur-[1px]">
                        <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#1a1410] shadow-lg">
                          {isTempOut
                            ? t("product.out_of_stock_temp", "Out of stock temporarily")
                            : t("product.out_of_stock", "Currently out of stock")}
                        </span>
                      </div>
                    );
                  })()}

                  {product.badge && (
                    <span className="absolute left-4 top-4 rounded-full bg-[#faf6ee]/95 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#b98a3e] shadow-sm backdrop-blur">
                      {product.badge === "Special Offer" ||
                      product.badge === "Sale"
                        ? t("product.special_offer", "Sale")
                        : product.badge}
                    </span>
                  )}

                  {hasImages && (
                    <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      <ZoomInIcon />
                      {t("product.tap_to_zoom", "Tap to zoom")}
                    </span>
                  )}
                </div>
              </button>

              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2.5">
                  {images.map((image, index) => {
                    const active = safeIndex === index;
                    return (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedImage(index);
                          setLightboxOpen(true);
                        }}
                        className={`group relative aspect-square overflow-hidden rounded-xl border-2 bg-[#f5f0e6] transition-all ${
                          active
                            ? "border-[#b98a3e] shadow-md"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        aria-label={`View image ${index + 1}`}
                      >
                        <ProductImage
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full"
                          contain
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 🎬 VIDEO — now below the product image / thumbnails */}
              {videoUrl && (
                <div className="mx-auto w-full max-w-[440px]">
                  <ProductVideo src={videoUrl} title={product.name} />
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: Info ── */}
            <div className="flex flex-col justify-center">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="rounded-full bg-[#1a1410] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.17em] text-[#e0a83c]">
                  {product.category}
                </span>
                <span className="text-[11px] font-medium text-[#7a6a58]">
                  {t("product.direct_from_factory", "Marketplace listing")}
                </span>
              </div>

              <h1 className="font-serif-heading text-left text-3xl font-medium leading-[1.02] tracking-[-0.04em] text-[#1a1410] sm:text-4xl lg:text-[3.2rem]">
                {product.name}
              </h1>

              <div className="my-5 h-px bg-[#3a2a1e]/10" />

              {/* Main price — big, top */}
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-serif-heading text-3xl font-semibold tracking-[-0.035em] text-[#1a1410] sm:text-[2.75rem]">
                    {formatMoney(price, currency)}
                  </span>
                  <span className="pb-1 text-sm text-[#7a6a58]">
                    {t("product.per", "per")} {product.unit}
                  </span>
                </div>
                {hasDiscount && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      {formatMoney(effectivePrice, currency)} disc
                    </span>
                    <span className="text-xs font-semibold text-red-600">
                      Save {formatMoney(price - effectivePrice, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Other currencies — below main price */}
              {otherPrices.length > 0 && (
                <div className="mt-3 rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee] p-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b98a3e]">
                    {t("product.also_available_in", "Also available in")}
                  </p>
                  <div className="space-y-1">
                    {otherPrices.map((p) => {
                      const currencyDiscount = discountMap.get(p.currency.toUpperCase());
                      const hasCurrencyDiscount =
                        currencyDiscount != null &&
                        currencyDiscount > 0 &&
                        currencyDiscount < p.amount;
                      const saving = hasCurrencyDiscount ? p.amount - currencyDiscount : 0;
                      return (
                        <div
                          key={p.currency}
                          className="flex flex-col gap-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#7a6a58]">
                              {p.currency}
                            </span>
                            <span className="font-semibold text-[#1a1410]">
                              {formatMoney(p.amount, p.currency)}
                            </span>
                          </div>
                          {hasCurrencyDiscount && (
                            <div className="flex items-center gap-2 pl-4">
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                {formatMoney(currencyDiscount, p.currency)} disc
                              </span>
                              <span className="text-xs font-semibold text-red-600">
                                Save {formatMoney(saving, p.currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const isTempOut =
                  product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
                const isAvailable = product.stock > 0 && !isTempOut;
                return (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isAvailable
                          ? "bg-emerald-500"
                          : isTempOut
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span
                      className={
                        isAvailable
                          ? "font-semibold text-emerald-700"
                          : isTempOut
                          ? "font-semibold text-amber-700"
                          : "text-[#7a6a58]"
                      }
                    >
                      {isAvailable
                        ? t("product.available_now", "Available now")
                        : isTempOut
                        ? t("product.out_of_stock_temp", "Out of stock temporarily")
                        : t("product.out_of_stock", "Currently out of stock")}
                    </span>
                  </div>
                );
              })()}

              {/* Reward badges */}
              {(product.rewards || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(product.rewards || []).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReward(r)}
                      className="flex w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-300"
                    >
                      <Gift className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{rewardBadgeText(r)}</span>
                      {r.promoCode && (
                        <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {r.promoCode}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Size selector */}
              {hasSizes && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b98a3e]">
                    {t("product.select_size", "Select Size")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sizeVariants.map((s) => {
                      const active = selectedSize === s.size;
                      const out = s.stock < 1;
                      return (
                        <button
                          key={s.size}
                          type="button"
                          onClick={() => setSelectedSize(active ? null : s.size)}
                          disabled={out}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "border-[#1a1410] bg-[#1a1410] text-white"
                              : out
                              ? "border-[#3a2a1e]/15 bg-[#faf6ee] text-[#7a6a58]/50 cursor-not-allowed"
                              : "border-[#3a2a1e]/15 bg-white text-[#1a1410] hover:border-[#b98a3e]"
                          }`}
                        >
                          {s.size}
                          <span className={`ml-1.5 text-[10px] font-medium ${active ? "text-white/70" : "text-[#7a6a58]"}`}>
                            {out
                              ? t("product.size_out", "Out")
                              : `${s.stock} ${t("product.in_stock", "in stock")}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {activeSize && (
                    <p className="mt-2 text-xs text-[#7a6a58]">
                      {t("product.size_selected", "Selected")}: <strong>{activeSize.size}</strong>
                      {activeSize.sku ? ` · SKU: ${activeSize.sku}` : ""}
                    </p>
                  )}
                </div>
              )}

              {/* Live stock & countdown badges */}
              <div className="mt-3">
                <ProductCountdown
                  stock={effectiveStock}
                  availableAt={product.availableAt}
                  restockDate={product.restockDate}
                  saleEndDate={product.saleEndDate}
                  variant="detail"
                />
              </div>

              {/* Description */}
              <section
                aria-labelledby="product-description-heading"
                className={`mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 sm:p-5 ${
                  product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" || product.stock < 1
                    ? "ring-amber-200"
                    : "ring-[#3a2a1e]/5"
                }`}
              >
                <h2
                  id="product-description-heading"
                  className="text-xs font-bold uppercase tracking-[0.16em] text-[#b98a3e]"
                >
                  {t("product.description_title", "Product Description")}
                </h2>
                {(() => {
                  const isTempOut =
                    product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
                  const isAvailable = product.stock > 0 && !isTempOut;
                  if (!isAvailable) {
                    return (
                      <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 font-medium text-amber-700">
                        {isTempOut
                          ? t(
                              "product.temp_out_desc",
                              "This product is temporarily out of stock. We'll restock it soon — please check back later or contact us for availability."
                            )
                          : t(
                              "product.out_desc",
                              "This product is currently out of stock. Please check back later or contact us for availability."
                            )}
                      </p>
                    );
                  }
                  return (
                    <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[#625448]">
                      {product.description?.trim() ||
                        t(
                          "product.description_unavailable",
                          "No description has been added for this product yet."
                        )}
                    </p>
                  );
                })()}
              </section>

              {/* CTA buttons */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={addToCart}
                  disabled={ctaDisabled}
                  className={ctaButtonClass}
                >
                  <ShoppingCart size={18} />
                  {ctaLabel}
                </button>
                <Link
                  href="/contact"
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#EB6D3D] px-5 text-base font-bold text-[#20283a] shadow-lg transition-all duration-200 hover:bg-[#cf5427] hover:text-white hover:shadow-xl"
                >
                  <span>{t("product.request_quote", "Request a Quote")}</span>
                  <span className="text-xl font-bold">→</span>
                </Link>
              </div>

              {cartMessage && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EB6D3D]/30 bg-white px-4 py-3 text-sm text-[#20283a]">
                  <span role="status">{cartMessage}</span>
                  <Link
                    href="/checkout"
                    className="rounded-xl bg-[#cf5427] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#b84520]"
                  >
                    {t("checkout.go_to_checkout", "Go to checkout")}
                  </Link>
                </div>
              )}

              {/* Benefits */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#3a2a1e]/5">
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#f3ecdf] text-[#1a1410]">
                    <CheckIcon />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a1410]">
                      {t("product.benefit_price_title", "Easy Discovery")}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-[#7a6a58]">
                      {t(
                        "product.benefit_price_desc",
                        "Browse products in one place."
                      )}
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${BUSINESS_PHONE_TEL}`}
                  className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#3a2a1e]/5 transition hover:bg-[#faf6ee]"
                  aria-label={`Call ${BUSINESS_PHONE}`}
                >
                  <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#f3ecdf] text-[#1a1410]">
                    <PhoneIcon />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a1410]">
                      {t("product.benefit_phone_title", "Call Us")}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[#b98a3e]">
                      {BUSINESS_PHONE}
                    </p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Feedback Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ProductFeedback productId={product.id} />
      </div>

      {/* Bottom CTA — same actions as the top buttons */}
      <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-[28px] bg-[#f5f1ea]/95 p-4 shadow-[0_20px_60px_rgba(58,42,30,0.08)] ring-1 ring-[#3a2a1e]/5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={addToCart}
              disabled={ctaDisabled}
              className={ctaButtonClass}
            >
              <ShoppingCart size={18} />
              {ctaLabel}
            </button>
            <Link
              href="/contact"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#EB6D3D] px-5 text-base font-bold text-[#20283a] shadow-lg transition-all duration-200 hover:bg-[#cf5427] hover:text-white hover:shadow-xl"
            >
              <span>{t("product.request_quote", "Request a Quote")}</span>
              <span className="text-xl font-bold">→</span>
            </Link>
          </div>
          {cartMessage && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EB6D3D]/30 bg-white px-4 py-3 text-sm text-[#20283a]">
              <span role="status">{cartMessage}</span>
              <Link
                href="/checkout"
                className="rounded-xl bg-[#cf5427] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#b84520]"
              >
                {t("checkout.go_to_checkout", "Go to checkout")}
              </Link>
            </div>
          )}
        </div>
      </section>

      {lightboxOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={safeIndex}
          alt={product.name}
          onClose={() => setLightboxOpen(false)}
          onSelect={setSelectedImage}
        />
      )}

      {selectedReward && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedReward(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Gift className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Purchase Reward</h3>
                  <p className="text-xs text-slate-500">{selectedReward.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReward(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Condition</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {selectedReward.triggerType === "MIN_QUANTITY"
                    ? `Buy ${Number(selectedReward.threshold)} or more`
                    : `Spend ${Number(selectedReward.threshold).toLocaleString()} ${selectedReward.currency || "ETB"} or more`}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Reward</dt>
                <dd className="text-right font-semibold text-emerald-700">
                  {selectedReward.rewardType === "PERCENT_DISCOUNT"
                    ? `${selectedReward.rewardValue}% discount`
                    : selectedReward.rewardType === "FREE_ITEM"
                    ? `Free ${selectedReward.rewardValue}`
                    : selectedReward.rewardType === "MOBILE_AIRTIME"
                    ? `${selectedReward.rewardValue} ${selectedReward.currency || "ETB"} airtime`
                    : selectedReward.rewardType === "CUSTOM"
                    ? selectedReward.rewardValue
                    : `${selectedReward.rewardValue} ${selectedReward.currency || "ETB"} cashback`}
                </dd>
              </div>
              {selectedReward.promoCode && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Promo code</dt>
                  <dd>
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                      {selectedReward.promoCode}
                    </span>
                  </dd>
                </div>
              )}
              {selectedReward.expiresAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Valid until</dt>
                  <dd className="font-semibold text-slate-800">
                    {new Date(selectedReward.expiresAt).toLocaleDateString("en-ET", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              The reward is confirmed automatically when your order qualifies. Our team will contact you to deliver it.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}