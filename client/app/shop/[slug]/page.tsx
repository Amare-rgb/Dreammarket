// app/shop/[slug]/page.tsx
import ProductDetails from "@/components/shop/ProductDetails";
import { notFound } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  discountPrice: number | null;
  unit: string;
  stock: number;
  featured: boolean;
  badge?: string;
  images: string[];
}

// ✅ Next.js 15+: params is ALWAYS a Promise
type ProductDetailsPageProps = {
  params: Promise<{ slug: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// API base
// ─────────────────────────────────────────────────────────────────────────────
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// Image resolver — Cloudinary ONLY
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default async function ProductDetailsPage({
  params,
}: ProductDetailsPageProps) {
  // ✅ Await the Promise before reading properties
  const resolvedParams = await params;
  const rawSlug = resolvedParams?.slug || "";
  const slug = decodeURIComponent(rawSlug).toLowerCase().trim();

  let fetchedProduct: Product | null = null;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/products/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );

    if (res.ok) {
      const data: unknown = await res.json();

      // Backend sometimes wraps product in { product: ... } or { data: ... }
      const raw =
        (data as { product?: unknown; data?: unknown })?.product ??
        (data as { data?: unknown })?.data ??
        data;

      const rawObj = raw as {
        id?: string;
        slug?: string;
        name?: string;
        description?: string;
        price?: number | string;
        discountPrice?: number | string | null;
        unitOfMeasurement?: string;
        stock?: number;
        isFeatured?: boolean;
        category?: { name?: string } | null;
        images?: unknown[];
      };

      if (rawObj && rawObj.id) {
        // ✅ Explicit typing — no implicit `any`
        const rawImages: unknown[] = Array.isArray(rawObj.images)
          ? rawObj.images
          : [];
        const imageList: string[] = rawImages
          .map((img) => resolveImage(img))
          .filter((u): u is string => typeof u === "string");

        fetchedProduct = {
          id: rawObj.id,
          slug: rawObj.slug || rawObj.id,
          name: rawObj.name || "Untitled Product",
          category: rawObj.category?.name || "Other Products",
          description: rawObj.description || "",
          price: Number(rawObj.price || 0),
          discountPrice:
            rawObj.discountPrice !== null &&
            rawObj.discountPrice !== undefined
              ? Number(rawObj.discountPrice)
              : null,
          unit: rawObj.unitOfMeasurement || "pcs",
          stock: typeof rawObj.stock === "number" ? rawObj.stock : 0,
          featured: Boolean(rawObj.discountPrice || rawObj.isFeatured),
          badge: rawObj.discountPrice ? "Sale" : undefined,
          images: imageList,
        };
      }
    } else if (res.status === 404) {
      console.log(`Product with slug "${slug}" not found`);
    }
  } catch (err) {
    console.warn("Could not fetch product from backend on slug page:", err);
  }

  if (!fetchedProduct) {
    notFound();
  }

  return <ProductDetails product={fetchedProduct} />;
}