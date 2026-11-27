// app/admin/products/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { ArrowLeft, Edit, Trash2, Package, Tag, Calendar, CheckCircle, XCircle, AlertCircle, Info, Video as VideoIcon } from "lucide-react";
import { hardNavigate } from "@/lib/navigation";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

function resolveImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
}

const resolveVideo = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
};

const getVideoEmbedUrl = (url: string) => {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:.*#|.*\/videos\/)?([0-9]+)/);
  if (vm?.[1]) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
};

const api = axios.create({ baseURL: API_URL, headers: { "Content-Type": "application/json" }, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      ["token", "authToken", "user"].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
      hardNavigate("/auth/signin");
    }
    return Promise.reject(error);
  }
);

interface ProductPrice { currency: string; amount: number; }
interface Product {
  id: string; name: string; description: string;
  category: { id: string; name: string; slug: string } | null;
  subCategory?: { id: string; name: string; slug: string } | null;
  price: number; currency?: string; prices?: ProductPrice[] | null;
  discountPrice?: number; discountPrices?: { currency: string; amount: number }[] | null;
  stock: number; availabilityStatus?: string; outOfStockAt?: string | null;
  autoRestock?: boolean; restockAfterDays?: number; restockQuantity?: number;
  sku: string; images: string[]; videoUrl?: string | null; tags: string[];
  brand?: string; weight?: number; unitOfMeasurement?: string; pricePerUnit?: number; durationTime?: string;
  createdAt: string; updatedAt: string;
}
interface DetailPageProps { params: Promise<{ id: string }>; }
interface NotificationProps { type: "success" | "error" | "info" | "warning"; message: string; onClose: () => void; }

const DEFAULT_CURRENCY = "ETB";

const formatMoney = (amount: number, currency: string = DEFAULT_CURRENCY) => {
  const v = Number(amount) || 0;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
  catch { return `${currency} ${v.toFixed(2)}`; }
};

const getProductPrices = (product: Product): ProductPrice[] => {
  if (Array.isArray(product.prices) && product.prices.length > 0) return product.prices.filter((p) => p && typeof p.currency === "string" && Number(p.amount) > 0);
  return [{ currency: product.currency || DEFAULT_CURRENCY, amount: product.price }];
};

const Notification: React.FC<NotificationProps> = ({ type, message, onClose }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icon = type === "success" ? <CheckCircle className="w-5 h-5 text-yellow-500" /> : type === "error" ? <XCircle className="w-5 h-5 text-red-500" /> : type === "warning" ? <AlertCircle className="w-5 h-5 text-yellow-500" /> : <Info className="w-5 h-5 text-blue-500" />;
  const colors = type === "success" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : type === "error" ? "bg-red-50 border-red-200 text-red-800" : type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-blue-50 border-blue-200 text-blue-800";

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}`}>
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${colors}`}>
        {icon}
        <p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="text-gray-400 hover:text-gray-600 transition-colors"><XCircle className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("authToken"));
};

const redirectToLogin = (router: ReturnType<typeof useRouter>) => {
  ["token", "authToken", "user"].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
  router.push("/auth/signin");
};

const ProductImage: React.FC<{ src: string | null; alt: string; className?: string; priority?: boolean }> = ({ src, alt, className = "", priority = false }) => {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  if (src !== prevSrc) { setPrevSrc(src); setHasError(false); }
  if (!src || hasError) return <div className={`flex items-center justify-center bg-gray-100 ${className}`}><Package className="w-8 h-8 text-gray-400" /></div>;
  return <Image src={src} alt={alt} width={400} height={400} className={`object-cover ${className}`} onError={() => setHasError(true)} priority={priority} unoptimized />;
};

const ProductDetailPage: React.FC<DetailPageProps> = ({ params }) => {
  const router = useRouter();
  const { id: productId } = React.use(params);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);

  const showNotification = (type: "success" | "error" | "info" | "warning", message: string) => setNotification({ type, message });
  const clearNotification = () => setNotification(null);

  useEffect(() => {
    if (!isAuthenticated()) { redirectToLogin(router); return; }
    let active = true;
    api.get(`/api/products/${productId}`)
      .then((response) => {
        if (!active) return;
        let data = response.data;
        if (response.data?.product) data = response.data.product;
        else if (response.data?.data) data = response.data.data;
        if (data) setProduct(data);
        else setError("Product not found");
      })
      .catch((err) => {
        if (!active) return;
        console.error("Error fetching product:", err);
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) setError("Product not found");
          else if (err.response?.status !== 401) setError(err.response?.data?.error || "Failed to load product");
        } else setError("An unexpected error occurred");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, router]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      if (!isAuthenticated()) { redirectToLogin(router); return; }
      const response = await api.delete(`/api/products/${productId}`);
      if (response.data.success) {
        showNotification("success", "Product deleted successfully!");
        setTimeout(() => router.push("/admin/products"), 1500);
      } else showNotification("error", response.data.error || "Failed to delete product");
    } catch (err) {
      console.error("Error deleting product:", err);
      if (axios.isAxiosError(err)) showNotification("error", err.response?.data?.error || "Failed to delete product");
      else showNotification("error", "An unexpected error occurred");
    }
  };

  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A";

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
            <p className="text-red-600 font-medium">{error || "Product not found"}</p>
          </div>
          <Link href="/admin/products" className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors">Back to Products</Link>
        </div>
      </div>
    );
  }

  const prices = getProductPrices(product);
  const mainCurrency = prices[0]?.currency || DEFAULT_CURRENCY;
  const videoUrl = resolveVideo(product.videoUrl);
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;
  const discounts = Array.isArray(product.discountPrices) && product.discountPrices.length > 0
    ? product.discountPrices
    : product.discountPrice != null ? [{ currency: mainCurrency, amount: product.discountPrice }] : [];
  const validDiscounts = discounts.filter((d) => d.amount > 0 && d.amount < (product.prices?.find((p) => p.currency === d.currency)?.amount ?? product.price));
  const isTempOut = product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY";
  const isAvailable = product.stock > 0 && !isTempOut;

  const detailRows = [
    { label: "SKU", value: product.sku || "N/A" },
    ...(product.brand ? [{ label: "Brand", value: product.brand }] : []),
    ...(product.weight ? [{ label: "Weight", value: `${product.weight} ${product.unitOfMeasurement || "pcs"}` }] : []),
    ...(product.durationTime ? [{ label: "Duration", value: product.durationTime }] : []),
  ];

  return (
    <div className="space-y-6">
      {notification && <Notification type={notification.type} message={notification.message} onClose={clearNotification} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/products" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{product.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">Product ID: #{product.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Link href={`/admin/products/${product.id}/edit`} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors"><Edit className="w-3.5 h-3.5" /><span>Edit</span></Link>
          <button onClick={handleDelete} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /><span>Delete</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500"><Calendar className="w-4 h-4" /><span>Created: {formatDate(product.createdAt)}</span></div>
              {product.category && (
                <div className="flex items-center space-x-2 text-sm text-gray-500"><Tag className="w-4 h-4" /><span>{product.category.name}{product.subCategory && ` › ${product.subCategory.name}`}</span></div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Product Images</h3>
            {product.images && product.images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {product.images.map((img, index) => {
                  const imageUrl = resolveImage(img);
                  return (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative group">
                      <ProductImage src={imageUrl} alt={`${product.name} - ${index + 1}`} className="w-full h-full" priority={index === 0} />
                      <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded-full">{index + 1}/{product.images.length}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500"><Package className="w-12 h-12 text-gray-300 mx-auto mb-2" /><p className="text-sm">No images available</p></div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Product Video</h3>
            {videoUrl ? (
              <div className="overflow-hidden rounded-lg bg-black">
                {embedUrl ? <iframe src={embedUrl} className="w-full aspect-video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video src={videoUrl} controls playsInline preload="metadata" className="max-h-[420px] w-full" />}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500"><VideoIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" /><p className="text-sm">No video available</p></div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Product Details</h3>
            <div className="grid grid-cols-2 gap-4">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{row.label}:</span>
                  <span className="text-sm font-medium text-gray-900">{row.value}</span>
                </div>
              ))}
              {product.tags && product.tags.length > 0 && (
                <div className="col-span-2 flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Tags:</span>
                  <div className="flex flex-wrap gap-1">
                    {product.tags.map((tag, index) => <span key={index} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full">{tag}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Pricing</h3>
            <div className="space-y-3">
              {prices.map((p, index) => (
                <div key={`${p.currency}-${index}`} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{index === 0 ? `Price (${p.currency})` : p.currency}</span>
                  <span className={index === 0 ? "text-lg font-bold text-gray-900" : "text-sm font-semibold text-gray-700"}>{formatMoney(p.amount, p.currency)}</span>
                </div>
              ))}
              {validDiscounts.map((d) => {
                const original = product.prices?.find((p) => p.currency === d.currency)?.amount ?? product.price;
                const saving = original - d.amount;
                return (
                  <div key={d.currency} className="flex justify-between items-center border-t border-gray-100 pt-3">
                    <span className="text-sm text-gray-600">Discount ({d.currency})</span>
                    <span className="text-lg font-bold text-yellow-600">
                      {formatMoney(d.amount, d.currency)}
                      <span className="ml-2 text-xs font-normal text-gray-500">(was {formatMoney(original, d.currency)}, save {formatMoney(saving, d.currency)})</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Inventory</h3>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Stock Available</span>
              <span className={`text-lg font-bold ${product.stock === 0 ? "text-red-600" : product.stock < 10 ? "text-yellow-600" : "text-gray-900"}`}>{product.stock || 0}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? "bg-emerald-500" : isTempOut ? "bg-amber-500" : "bg-red-500"}`} />
              <span className={`text-sm font-semibold ${isAvailable ? "text-emerald-700" : isTempOut ? "text-amber-700" : "text-red-600"}`}>{isAvailable ? "Available now" : isTempOut ? "Out of stock temporarily" : "Out of stock"}</span>
            </div>
            {product.stock === 0 && <p className="text-xs text-red-500 mt-2">Out of Stock</p>}
            {product.stock < 10 && product.stock > 0 && <p className="text-xs text-yellow-500 mt-2">Low Stock</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;