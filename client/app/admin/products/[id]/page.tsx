// app/admin/products/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  Tag,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Clock,
  Video as VideoIcon,
} from "lucide-react";

// ============================================================
// API base
// ============================================================
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_URL = RAW_API_BASE.replace(/\/+$/, "");

// ============================================================
// Media resolvers — Cloudinary / full URLs only
// ============================================================
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

// ✅ Helper: Check if URL is a YouTube (including Shorts) or Vimeo link and convert to embed URL
const getVideoEmbedUrl = (url: string) => {
  if (!url) return null;
  
  // Matches watch?v=, youtu.be/, /embed/, and /shorts/
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  
  const vimeoMatch = url.match(/vimeo\.com\/(?:.*#|.*\/videos\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  
  return null;
};

// ============================================================
// Axios instance
// ============================================================
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");
      if (typeof window !== "undefined") {
        window.location.href = "/auth/signin";
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// Types
// ============================================================
interface ProductPrice {
  currency: string;
  amount: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  subCategory?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  price: number;
  currency?: string;
  prices?: ProductPrice[] | null;
  discountPrice?: number;
  stock: number;
  sku: string;
  images: string[];
  videoUrl?: string | null;
  tags: string[];
  brand?: string;
  weight?: number;
  unitOfMeasurement?: string;
  pricePerUnit?: number;
  durationTime?: string;
  createdAt: string;
  updatedAt: string;
}

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

// ============================================================
// Money helpers
// ============================================================
const DEFAULT_CURRENCY = "ETB";

const formatMoney = (amount: number, currency: string = DEFAULT_CURRENCY) => {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const getProductPrices = (product: Product): ProductPrice[] => {
  if (Array.isArray(product.prices) && product.prices.length > 0) {
    return product.prices.filter(
      (p) => p && typeof p.currency === "string" && Number(p.amount) > 0
    );
  }
  return [
    {
      currency: product.currency || DEFAULT_CURRENCY,
      amount: product.price,
    },
  ];
};

// ============================================================
// Notification
// ============================================================
interface NotificationProps {
  type: "success" | "error" | "info" | "warning";
  message: string;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case "success":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "error":
        return "bg-red-50 border-red-200 text-red-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
      }`}
    >
      <div
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${getColors()}`}
      >
        {getIcon()}
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ============================================================
// Auth helpers
// ============================================================
const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken");
  return !!token;
};

const redirectToLogin = (router: ReturnType<typeof useRouter>) => {
  localStorage.removeItem("token");
  localStorage.removeItem("authToken");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("authToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("user");
  router.push("/auth/signin");
};

// ============================================================
// ProductImage — single fallback (Package icon)
// ============================================================
const ProductImage: React.FC<{
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}> = ({ src, alt, className = "", priority = false }) => {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
      >
        <Package className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={400}
      className={`object-cover ${className}`}
      onError={() => setHasError(true)}
      priority={priority}
      unoptimized
    />
  );
};

// ============================================================
// Main component
// ============================================================
const ProductDetailPage: React.FC<DetailPageProps> = ({ params }) => {
  const router = useRouter();
  const { id: productId } = React.use(params);

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  const showNotification = (
    type: "success" | "error" | "info" | "warning",
    message: string
  ) => setNotification({ type, message });

  const clearNotification = () => setNotification(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin(router);
      return;
    }

    let active = true;

    api
      .get(`/api/products/${productId}`)
      .then((response) => {
        if (!active) return;

        let productData = response.data;
        if (response.data?.product) {
          productData = response.data.product;
        } else if (response.data?.data) {
          productData = response.data.data;
        }

        if (productData) {
          setProduct(productData);
        } else {
          setError("Product not found");
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error("Error fetching product:", err);

        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError("Product not found");
          } else if (err.response?.status !== 401) {
            setError(err.response?.data?.error || "Failed to load product");
          }
        } else {
          setError("An unexpected error occurred");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, router]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      if (!isAuthenticated()) {
        redirectToLogin(router);
        return;
      }

      const response = await api.delete(`/api/products/${productId}`);

      if (response.data.success) {
        showNotification("success", "Product deleted successfully!");
        setTimeout(() => router.push("/admin/products"), 1500);
      } else {
        showNotification(
          "error",
          response.data.error || "Failed to delete product"
        );
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      if (axios.isAxiosError(err)) {
        showNotification(
          "error",
          err.response?.data?.error || "Failed to delete product"
        );
      } else {
        showNotification("error", "An unexpected error occurred");
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 font-medium">
              {error || "Product not found"}
            </p>
          </div>
          <Link
            href="/admin/products"
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const prices = getProductPrices(product);
  const mainCurrency = prices[0]?.currency || DEFAULT_CURRENCY;
  const videoUrl = resolveVideo(product.videoUrl);

  return (
    <div className="space-y-6">
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={clearNotification}
        />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/products"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {product.name}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Product ID: #{product.id}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href={`/admin/products/${product.id}/edit`}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Meta info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>Created: {formatDate(product.createdAt)}</span>
              </div>
              {product.category && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Tag className="w-4 h-4" />
                  <span>
                    {product.category.name}
                    {product.subCategory && ` › ${product.subCategory.name}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Product Images
            </h3>
            {product.images && product.images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {product.images.map((img, index) => {
                  const imageUrl = resolveImage(img);

                  return (
                    <div
                      key={index}
                      className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group"
                    >
                      <ProductImage
                        src={imageUrl}
                        alt={`${product.name} - ${index + 1}`}
                        className="w-full h-full"
                        priority={index === 0}
                      />
                      <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded-full">
                        {index + 1}/{product.images.length}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No images available</p>
              </div>
            )}
          </div>

          {/* ✅ FIXED: Video Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Product Video
            </h3>
            {videoUrl ? (
              <div className="overflow-hidden rounded-lg bg-black">
                {/* If it's YouTube/Vimeo, render an iframe. Otherwise render a standard video tag. */}
                {getVideoEmbedUrl(videoUrl) ? (
                  <iframe
                    src={getVideoEmbedUrl(videoUrl)!}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-[420px] w-full"
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <VideoIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No video available</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">
              Description
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {product.description}
            </p>
          </div>

          {/* Product Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Product Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">SKU:</span>
                <span className="text-sm font-medium text-gray-900">
                  {product.sku || "N/A"}
                </span>
              </div>
              {product.brand && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Brand:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {product.brand}
                  </span>
                </div>
              )}
              {product.weight && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Weight:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {product.weight} {product.unitOfMeasurement || "pcs"}
                  </span>
                </div>
              )}
              {product.durationTime && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Duration:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {product.durationTime}
                  </span>
                </div>
              )}
              {product.tags && product.tags.length > 0 && (
                <div className="col-span-2 flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {product.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing — one row per currency */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Pricing
            </h3>
            <div className="space-y-3">
              {prices.map((p, index) => (
                <div
                  key={`${p.currency}-${index}`}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm text-gray-600">
                    {index === 0 ? `Price (${p.currency})` : p.currency}
                  </span>
                  <span
                    className={
                      index === 0
                        ? "text-lg font-bold text-gray-900"
                        : "text-sm font-semibold text-gray-700"
                    }
                  >
                    {formatMoney(p.amount, p.currency)}
                  </span>
                </div>
              ))}

              {product.discountPrice &&
                product.discountPrice < product.price && (
                  <>
                    <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                      <span className="text-sm text-gray-600">
                        Discounted Price ({mainCurrency})
                      </span>
                      <span className="text-lg font-bold text-yellow-600">
                        {formatMoney(product.discountPrice, mainCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-yellow-600">You Save</span>
                      <span className="text-yellow-600 font-medium">
                        {formatMoney(
                          product.price - product.discountPrice,
                          mainCurrency
                        )}
                      </span>
                    </div>
                  </>
                )}
              {product.discountPrice &&
                product.discountPrice >= product.price && (
                  <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                    <span className="text-sm text-red-500">
                      Invalid discount price
                    </span>
                    <span className="text-sm text-red-500 line-through">
                      {formatMoney(product.discountPrice, mainCurrency)}
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Inventory */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Inventory
            </h3>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Stock Available</span>
              <span
                className={`text-lg font-bold ${
                  product.stock === 0
                    ? "text-red-600"
                    : product.stock < 10
                    ? "text-yellow-600"
                    : "text-gray-900"
                }`}
              >
                {product.stock || 0}
              </span>
            </div>
            {product.stock === 0 && (
              <p className="text-xs text-red-500 mt-2">Out of Stock</p>
            )}
            {product.stock < 10 && product.stock > 0 && (
              <p className="text-xs text-yellow-500 mt-2">Low Stock</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;