// components/shop/ProductDetails.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Play } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { readCart, writeCart } from "@/app/lib/cart";

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
  unit: string;
  stock: number;
  featured?: boolean;
  badge?: string;
  images: string[];
  videoUrl: string | null;
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
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close fullscreen image"
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <CloseIcon />
      </button>

      <div
        className="relative h-full w-full max-h-[92vh] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-contain"
          sizes="100vw"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video section — plays inline + "Fullscreen" lightbox
// ─────────────────────────────────────────────────────────────────────────────
function ProductVideo({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);

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
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[360px] object-contain bg-black"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1a1410] shadow hover:bg-white"
        >
          <Play className="h-3.5 w-3.5" />
          Fullscreen
        </button>
      </div>

      {open && (
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
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
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

  const hasDiscount =
    product.discountPrice !== null &&
    product.discountPrice !== undefined &&
    product.discountPrice > 0 &&
    product.discountPrice < price;

  const effectivePrice = hasDiscount ? (product.discountPrice as number) : price;

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
      const existing = cart.find((item) => item.productId === product.id);
      const nextQuantity = (existing?.quantity || 0) + 1;
      if (nextQuantity > product.stock) {
        setCartMessage(
          t("checkout.stock_limit", "There is not enough stock for another item.")
        );
        return;
      }

      if (existing) {
        writeCart(
          cart.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  name: product.name,
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
            productId: product.id,
            name: product.name,
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
              <div className="flex flex-wrap items-end gap-2.5 text-left">
                <span className="font-serif-heading text-3xl font-semibold tracking-[-0.035em] text-[#1a1410] sm:text-[2.75rem]">
                  {formatMoney(effectivePrice, currency)}
                </span>
                <span className="pb-1 text-sm text-[#7a6a58]">
                  {t("product.per", "per")} {product.unit}
                </span>
                {hasDiscount && (
                  <span className="pb-1 text-sm text-gray-400 line-through">
                    {formatMoney(price, currency)}
                  </span>
                )}
              </div>

              {/* Other currencies — below main price */}
              {otherPrices.length > 0 && (
                <div className="mt-3 rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee] p-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b98a3e]">
                    {t("product.also_available_in", "Also available in")}
                  </p>
                  <div className="space-y-1">
                    {otherPrices.map((p) => (
                      <div
                        key={p.currency}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium text-[#7a6a58]">
                          {p.currency}
                        </span>
                        <span className="font-semibold text-[#1a1410]">
                          {formatMoney(p.amount, p.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-sm">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    product.stock > 0 ? "bg-[#e0a83c]" : "bg-red-500"
                  }`}
                />
                <span className="text-[#7a6a58]">
                  {product.stock > 0
                    ? `${product.stock} ${product.unit} ${t(
                        "product.in_production_stock",
                        "available in this listing"
                      )}`
                    : t("product.out_of_stock", "Currently out of stock")}
                </span>
              </div>

              {/* Description */}
              <section
                aria-labelledby="product-description-heading"
                className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#3a2a1e]/5 sm:p-5"
              >
                <h2
                  id="product-description-heading"
                  className="text-xs font-bold uppercase tracking-[0.16em] text-[#b98a3e]"
                >
                  {t("product.description_title", "Product Description")}
                </h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[#625448]">
                  {product.description?.trim() ||
                    t(
                      "product.description_unavailable",
                      "No description has been added for this product yet."
                    )}
                </p>
              </section>

              {/* CTA buttons */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={addToCart}
                  disabled={product.stock < 1}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#20283a] bg-[#20283a] px-5 text-base font-bold text-white shadow-lg transition hover:bg-[#30384f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart size={18} />
                  {t("checkout.add_to_order", "Add to order")}
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
                    className="font-bold text-[#cf5427] underline underline-offset-2"
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

      {lightboxOpen && currentImage && (
        <ImageLightbox
          src={currentImage}
          alt={product.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}