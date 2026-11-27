import ProductDetails from "@/components/shop/ProductDetails";
import { notFound } from "next/navigation";

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
  featured: boolean;
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

type ProductDetailsPageProps = {
  params: Promise<{ slug: string }>;
};

const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, "");

const DEFAULT_CURRENCY = "ETB";

type MediaKind = "image" | "video";

function resolveMedia(raw: unknown, kind: MediaKind): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (kind === "image" && s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
}

interface RawPrice {
  currency?: string;
  amount?: number | string;
}

interface RawProduct {
  id?: string;
  _id?: string;
  slug?: string;
  name?: string;
  description?: string;
  price?: number | string;
  currency?: string;
  prices?: RawPrice[] | null;
  discountPrice?: number | string | null;
  discountPrices?: { currency: string; amount: number }[] | null;
  unitOfMeasurement?: string;
  stock?: number;
  availabilityStatus?: string | null;
  availableAt?: string | null;
  restockDate?: string | null;
  saleEndDate?: string | null;
  isFeatured?: boolean;
  category?: { name?: string } | null;
  categoryName?: string;
  images?: unknown[];
  videoUrl?: string | null;
  video?: string | null;
  sizesList?: { size?: string; stock?: number; sku?: string | null }[] | null;
  rewardRules?: {
    id: string;
    name: string;
    triggerType: string;
    threshold: number;
    rewardType: string;
    rewardValue: string;
    currency?: string | null;
    promoCode: string | null;
    expiresAt?: string | null;
  }[] | null;
}

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

function normalizePrices(raw: RawProduct): ProductPrice[] {
  const list: ProductPrice[] = [];

  if (Array.isArray(raw.prices)) {
    for (const p of raw.prices) {
      const currency = isNonEmptyString(p?.currency)
        ? p.currency.toUpperCase()
        : null;
      const amount = Number(p?.amount);
      if (currency && isPositiveNumber(amount)) {
        list.push({ currency, amount });
      }
    }
  }

  if (list.length === 0) {
    const amount = Number(raw.price);
    const currency = isNonEmptyString(raw.currency)
      ? raw.currency.toUpperCase()
      : DEFAULT_CURRENCY;
    list.push({ currency, amount: isPositiveNumber(amount) ? amount : 0 });
  }

  const seen = new Set<string>();
  return list.filter((p) => {
    if (seen.has(p.currency)) return false;
    seen.add(p.currency);
    return true;
  });
}

export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug ?? "";
  const slug = decodeURIComponent(rawSlug).toLowerCase().trim();

  if (!slug) notFound();

  let fetchedProduct: Product | null = null;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/products/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );

    if (res.ok) {
      const data: unknown = await res.json();
      const wrapped = data as { product?: unknown; data?: unknown };
      const raw = wrapped?.product ?? wrapped?.data ?? data;
      const rawObj = raw as RawProduct | null;
      const productId = rawObj?.id ?? rawObj?._id;

      if (rawObj && isNonEmptyString(productId)) {
        const prices = normalizePrices(rawObj);
        const primary = prices[0];
        const currency = primary.currency;
        const price = primary.amount;

        const rawImages: unknown[] = Array.isArray(rawObj.images)
          ? rawObj.images
          : [];
        const imageList = rawImages
          .map((img) => resolveMedia(img, "image"))
          .filter((u): u is string => typeof u === "string");

        const videoUrl =
          resolveMedia(rawObj.videoUrl, "video") ??
          resolveMedia(rawObj.video, "video");

        const rawDiscountNum = Number(rawObj.discountPrice);
        const hasDiscount =
          rawObj.discountPrice !== null &&
          rawObj.discountPrice !== undefined &&
          Number.isFinite(rawDiscountNum) &&
          rawDiscountNum > 0 &&
          rawDiscountNum < price;
        const discountPrice = hasDiscount ? rawDiscountNum : null;

        fetchedProduct = {
          id: productId,
          slug: rawObj.slug || productId,
          name: rawObj.name || "Untitled Product",
          category:
            rawObj.category?.name || rawObj.categoryName || "Other Products",
          description: rawObj.description || "",
          price,
          currency,
          prices,
          discountPrice,
          discountPrices: Array.isArray(rawObj.discountPrices) ? rawObj.discountPrices : null,
          unit: rawObj.unitOfMeasurement || "pcs",
          stock:
            typeof rawObj.stock === "number" && rawObj.stock >= 0
              ? rawObj.stock
              : 0,
          availabilityStatus: rawObj.availabilityStatus || undefined,
          availableAt: rawObj.availableAt || null,
          restockDate: rawObj.restockDate || null,
          saleEndDate: rawObj.saleEndDate || null,
          featured: hasDiscount || Boolean(rawObj.isFeatured),
          badge: hasDiscount ? "Sale" : undefined,
          images: imageList,
          videoUrl,
          sizes: (Array.isArray(rawObj.sizesList) ? rawObj.sizesList : [])
            .map((s) => ({
              size: typeof s?.size === "string" ? s.size.trim() : "",
              stock: typeof s?.stock === "number" ? s.stock : 0,
              sku: s?.sku ?? null,
            }))
            .filter((s) => s.size !== ""),
          rewards: (Array.isArray(rawObj.rewardRules) ? rawObj.rewardRules : []).map(
            (r) => ({
              id: r.id,
              name: r.name,
              triggerType: r.triggerType,
              threshold: Number(r.threshold) || 0,
              rewardType: r.rewardType,
              rewardValue: r.rewardValue,
              currency: r.currency ?? null,
              expiresAt: r.expiresAt ?? null,
              promoCode: r.promoCode ?? null,
            })
          ),
        };
      } else {
        console.warn(`Unexpected product payload for slug "${slug}"`);
      }
    } else if (res.status === 404) {
      console.warn(`Product with slug "${slug}" not found (404)`);
    } else {
      console.error(
        `Failed to fetch product "${slug}": HTTP ${res.status} ${res.statusText}`
      );
    }
  } catch (err) {
    console.error("Could not fetch product from backend on slug page:", err);
  }

  if (!fetchedProduct) notFound();

  return <ProductDetails product={fetchedProduct} />;
}