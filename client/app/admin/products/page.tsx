// app/admin/products/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import { Plus, Edit, Trash2, Eye, Search, Filter, ChevronDown, Package, RefreshCw, XCircle, AlertCircle, CheckCircle, Info, Image as ImageIcon, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import ProductCreateModal from "./ProductCreateModal";
import { hardNavigate } from "@/lib/navigation";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

function resolveImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
}

const resolveVideo = resolveImage;

const api = axios.create({ baseURL: API_URL, headers: { "Content-Type": "application/json" }, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token"); localStorage.removeItem("authToken"); sessionStorage.removeItem("token"); sessionStorage.removeItem("authToken"); localStorage.removeItem("user"); sessionStorage.removeItem("user");
      hardNavigate("/auth/signin");
    }
    return Promise.reject(error);
  }
);

interface Category { id: string; name: string; slug: string; parentId?: string | null; }
interface ProductPrice { currency: string; amount: number; }
interface Product {
  id: string; name: string; description: string; category: Category | null; subCategory?: Category | null;
  price: number; currency?: string; prices?: ProductPrice[] | null; discountPrice?: number; discountPrices?: { currency: string; amount: number }[] | null; salePrice?: number;
  stock: number; availabilityStatus?: string; outOfStockAt?: string | null; autoRestock?: boolean; restockAfterDays?: number; restockQuantity?: number;
  sku: string; images: string[]; videoUrl?: string | null; tags: string[]; brand?: string; weight?: number; unitOfMeasurement?: string; pricePerUnit?: number; durationTime?: string;
  status?: string; createdAt: string; updatedAt: string;
}
interface NotificationProps { type: "success" | "error" | "info" | "warning"; message: string; onClose: () => void; }

const DEFAULT_CURRENCY = "ETB";

const formatMoney = (amount: number, currency: string = DEFAULT_CURRENCY) => {
  const value = Number(amount) || 0;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
};

const getProductPrices = (product: Product): ProductPrice[] => {
  if (Array.isArray(product.prices) && product.prices.length > 0) return product.prices.filter((p) => p && typeof p.currency === "string" && Number(p.amount) > 0);
  return [{ currency: product.currency || DEFAULT_CURRENCY, amount: product.price }];
};

const Notification: React.FC<NotificationProps> = ({ type, message, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => { setIsVisible(false); setTimeout(onClose, 300); }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icon = type === "success" ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : type === "error" ? <XCircle className="w-5 h-5 text-red-500" /> : type === "warning" ? <AlertCircle className="w-5 h-5 text-yellow-500" /> : <Info className="w-5 h-5 text-blue-500" />;
  const colors = type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : type === "error" ? "bg-red-50 border-red-200 text-red-800" : type === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-blue-50 border-blue-200 text-blue-800";

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}`}>
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${colors}`}>
        {icon}
        <p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} className="text-gray-400 hover:text-gray-600 transition-colors"><XCircle className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const ProductImage: React.FC<{ src: string | null; alt: string; className?: string }> = ({ src, alt, className = "" }) => {
  const [error, setError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) { setPrevSrc(src); setError(false); }
  if (!src || error) return <div className={`flex items-center justify-center bg-gray-100 ${className}`}><ImageIcon className="w-5 h-5 text-gray-400" /></div>;
  return <Image src={src} alt={alt} width={48} height={48} className={`object-cover ${className}`} onError={() => setError(true)} unoptimized />;
};

const VideoPreviewModal: React.FC<{ url: string; title: string; onClose: () => void }> = ({ url, title, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Video of ${title}`} className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="truncate pr-3 text-sm font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close video" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X size={18} /></button>
        </header>
        <div className="bg-black"><video src={url} controls autoPlay playsInline preload="metadata" className="max-h-[70vh] w-full" /></div>
      </section>
    </div>
  );
};

function getPageNumbers(current: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(totalPages - 1, start + 4);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("...");
  pages.push(totalPages);
  return pages;
}

const ProductsPage: React.FC = () => {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "warning"; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [videoPreview, setVideoPreview] = useState<{ url: string; title: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isMounted = useRef(true);
  const hasFetchedInitial = useRef(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const tableTopRef = useRef<HTMLDivElement>(null);
  const refs = useRef({ currentPage, searchQuery, selectedCategory, statusFilter, pageSize });
  useEffect(() => { refs.current = { currentPage, searchQuery, selectedCategory, statusFilter, pageSize }; }, [currentPage, searchQuery, selectedCategory, statusFilter, pageSize]);

  const showNotification = (type: "success" | "error" | "info" | "warning", message: string) => setNotification({ type, message });
  const clearNotification = () => setNotification(null);
  const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  const scrollToTableTop = () => tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get("/api/categories/admin/all");
      const data = Array.isArray(response.data) ? response.data : response.data?.categories || [];
      if (isMounted.current) setCategories(data);
    } catch (err) { console.log("Categories fetch error:", err); }
  }, []);

  const fetchProducts = useCallback(async (opts?: { silent?: boolean; page?: number; search?: string; category?: string; status?: string }) => {
    const silent = opts?.silent ?? false;
    const { currentPage: page, searchQuery: search, selectedCategory: category, statusFilter: status, pageSize: size } = refs.current;
    const finalPage = opts?.page ?? page;
    const finalSearch = opts?.search ?? search;
    const finalCategory = opts?.category ?? category;
    const finalStatus = opts?.status ?? status;

    try {
      if (!silent) setRefreshing(true);
      if (!getToken()) { showNotification("error", "Authentication required. Please login again."); router.push("/auth/signin"); return; }

      const params = new URLSearchParams({ page: String(finalPage), limit: String(size) });
      if (finalSearch) params.append("search", finalSearch);
      if (finalCategory) params.append("categoryId", finalCategory);
      if (finalStatus === "PENDING" || finalStatus === "PUBLISHED") params.append("status", finalStatus);

      const response = await api.get(`/api/products/admin/all?${params.toString()}`);
      if (!isMounted.current) return;

      const list: Product[] = response.data?.products ?? [];
      setProducts(list);
      setTotal(response.data?.total ?? list.length);
      setPages(response.data?.pages ?? 1);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ error: string }>;
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) { showNotification("error", "Authentication failed. Please login again."); router.push("/auth/signin"); }
        else showNotification("error", axiosError.response?.data?.error || "Failed to fetch products");
      } else showNotification("error", "An unexpected error occurred");
    } finally {
      if (isMounted.current) { setRefreshing(false); setInitialLoading(false); }
    }
  }, [router]);

  useEffect(() => {
    isMounted.current = true;
    if (!hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      if (!getToken()) { const t = setTimeout(() => router.replace("/auth/signin"), 0); return () => clearTimeout(t); }
      const t = setTimeout(() => { void Promise.all([fetchCategories(), fetchProducts()]); }, 0);
      return () => { clearTimeout(t); isMounted.current = false; if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    }
    return () => { isMounted.current = false; if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [fetchCategories, fetchProducts, router]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      if (refs.current.currentPage !== 1) setCurrentPage(1);
      fetchProducts({ silent: true, page: 1, search: searchQuery });
    }, 500);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, fetchProducts]);

  useEffect(() => {
    const t = setTimeout(() => { if (refs.current.currentPage !== 1) setCurrentPage(1); fetchProducts({ silent: true, page: 1, category: selectedCategory }); }, 0);
    return () => clearTimeout(t);
  }, [selectedCategory, fetchProducts]);

  useEffect(() => {
    const t = setTimeout(() => { if (refs.current.currentPage !== 1) setCurrentPage(1); fetchProducts({ silent: true, page: 1, status: statusFilter }); }, 0);
    return () => clearTimeout(t);
  }, [statusFilter, fetchProducts]);

  const goToPage = (page: number) => {
    if (page < 1 || page > pages || page === currentPage || refreshing) return;
    setCurrentPage(page);
    void fetchProducts({ silent: true, page });
    scrollToTableTop();
  };

  const handleToggleAvailability = async (product: Product) => {
    const isTempOut = product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" || (product.stock <= 0 && product.availabilityStatus !== "AVAILABLE");
    const nextStatus = isTempOut ? "AVAILABLE" : "OUT_OF_STOCK_TEMPORARY";
    setTogglingId(product.id);
    try {
      const response = await api.patch(`/api/products/${product.id}/availability`, { availabilityStatus: nextStatus });
      if (response.data?.success) {
        showNotification("success", nextStatus === "AVAILABLE" ? `"${product.name}" is now Available now.` : `"${product.name}" marked as Out of stock temporarily.`);
        await fetchProducts({ silent: true, page: currentPage });
      }
    } catch (err) {
      console.error("Error toggling availability:", err);
      if (axios.isAxiosError(err)) showNotification("error", err.response?.data?.error || "Failed to update availability");
    } finally { setTogglingId(null); }
  };

  const handleProductCreated = () => {
    setShowCreateModal(false);
    setCurrentPage(1);
    showNotification("success", "Product created successfully.");
    void fetchProducts({ page: 1 });
  };

  const handleClearFilters = () => {
    setSelectedCategory(""); setStatusFilter(""); setSearchQuery(""); setCurrentPage(1);
    void fetchProducts({ silent: true, page: 1, search: "", category: "", status: "" });
  };

  const handleToggleStatus = async (product: Product) => {
    const nextStatus = product.status === "PUBLISHED" ? "PENDING" : "PUBLISHED";
    setStatusUpdatingId(product.id);
    try {
      const response = await api.patch(`/api/products/${product.id}/status`, { status: nextStatus });
      if (response.data?.success) {
        showNotification("success", nextStatus === "PUBLISHED" ? `"${product.name}" published — now live in the shop.` : `"${product.name}" moved back to pending.`);
        await fetchProducts({ silent: true, page: currentPage });
      }
    } catch (err) {
      console.error("Error updating product status:", err);
      showNotification("error", "Could not update the product status. Please try again.");
    } finally { setStatusUpdatingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      if (!getToken()) { showNotification("error", "Authentication required"); return; }
      const response = await api.delete(`/api/products/${id}`);
      if (response.data.success) {
        showNotification("success", "Product deleted successfully!");
        if (products.length === 1 && currentPage > 1) { const prevPage = currentPage - 1; setCurrentPage(prevPage); await fetchProducts({ silent: true, page: prevPage }); }
        else await fetchProducts({ silent: true, page: currentPage });
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      if (axios.isAxiosError(err)) showNotification("error", err.response?.data?.error || "Failed to delete product");
    }
  };

  const formatDate = (dateString: string) => dateString ? new Date(dateString).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "N/A";

  const getFirstImage = (images: string[] | null | undefined): string | null => {
    if (!images || images.length === 0) return null;
    for (const img of images) { if (img && img.trim() !== "") { const url = resolveImage(img); if (url) return url; } }
    return null;
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  const pageNumbers = getPageNumbers(currentPage, pages);
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  return (
    <div className="space-y-6">
      {notification && <Notification type={notification.type} message={notification.message} onClose={clearNotification} />}
      {showCreateModal && <ProductCreateModal categories={categories} onClose={() => setShowCreateModal(false)} onCreated={handleProductCreated} onCategoryAdded={() => void fetchCategories()} onCategoryDeleted={() => void fetchCategories()} />}
      {videoPreview && <VideoPreviewModal url={videoPreview.url} title={videoPreview.title} onClose={() => setVideoPreview(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your product inventory</p>
          <p className="text-xs text-gray-400 mt-1">Total: {total} products</p>
        </div>
        <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center space-x-2 px-3 py-1.5 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] transition-colors text-xs"><Plus className="w-3.5 h-3.5" /><span>Add Product</span></button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm" />
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><Filter className="w-3.5 h-3.5" /><span>Filters</span><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} /></button>
          <button onClick={() => void fetchProducts({ page: currentPage })} disabled={refreshing} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-[#EB6D3D] rounded-lg hover:bg-[#cf5427] transition-colors disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /><span>Refresh</span></button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm">
              <option value="">All Categories</option>
              {categories.filter((cat) => !cat.parentId).map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm">
              <option value="">All Statuses</option><option value="PENDING">Pending approval</option><option value="PUBLISHED">Published</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleClearFilters} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Clear Filters</button>
          </div>
        </div>
      )}

      <div ref={tableTopRef} className="bg-white rounded-xl border border-gray-200 overflow-hidden relative">
        {refreshing && <div className="absolute inset-0 bg-white/40 flex items-start justify-center pt-6 pointer-events-none z-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-500 border-t-transparent" /></div>}
        <div className="overflow-x-auto">
          {products.length > 0 ? (
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Product", "Category", "Prices", "Video", "Stock", "Availability", "Created", "Actions"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${i === 7 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => {
                  const imageUrl = getFirstImage(product.images);
                  const videoUrl = resolveVideo(product.videoUrl);
                  const prices = getProductPrices(product);
                  const mainCurrency = prices[0]?.currency || DEFAULT_CURRENCY;
                  const isTempOut = product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" || (product.stock <= 0 && product.availabilityStatus !== "AVAILABLE");
                  const isAvailable = !isTempOut && product.stock > 0;
                  const discounts = Array.isArray(product.discountPrices) && product.discountPrices.length > 0 ? product.discountPrices : product.discountPrice != null && product.discountPrice > 0 ? [{ currency: mainCurrency, amount: product.discountPrice }] : [];
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3 whitespace-nowrap">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200"><ProductImage src={imageUrl} alt={product.name} className="w-full h-full" /></div>
                          <div className="flex flex-col">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">{product.name}</p>
                            <div className="flex items-center space-x-1 text-xs text-gray-500"><span>SKU: {product.sku || "N/A"}</span></div>
                            <span className={`mt-1 inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${product.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{product.status === "PUBLISHED" ? "Published" : "Pending"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="flex items-center whitespace-nowrap"><span className="text-sm text-gray-900">{product.category?.name || "Uncategorized"}</span></div></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                          {prices.map((p, index) => <span key={`${p.currency}-${index}`} className={index === 0 ? "text-sm font-semibold text-gray-900" : "text-xs text-gray-600"}>{formatMoney(p.amount, p.currency)}</span>)}
                          {discounts.length > 0 && <span className="text-xs text-yellow-600 font-medium">Discount: {discounts.map((d) => { const original = product.prices?.find((p) => p.currency === d.currency)?.amount ?? product.price; const saving = original - d.amount; return `${d.currency} ${formatMoney(d.amount, d.currency)} (save ${formatMoney(saving, d.currency)})`; }).join(", ")}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {videoUrl ? <button type="button" onClick={() => setVideoPreview({ url: videoUrl, title: product.name })} className="inline-flex items-center gap-1.5 rounded-lg border border-[#EB6D3D] px-2.5 py-1 text-xs font-semibold text-[#cf5427] transition-colors hover:bg-[#EB6D3D]/10" title="Play product video"><Play className="w-3.5 h-3.5" />Play</button> : <span className="text-xs text-gray-400">No video</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`text-sm font-medium ${product.stock === 0 ? "text-red-600" : product.stock < 10 ? "text-yellow-600" : "text-gray-900"}`}>{product.stock || 0}</span></td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void handleToggleAvailability(product)} disabled={togglingId === product.id} title="Click to toggle availability" className="inline-flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50">
                          {isAvailable ? <><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-emerald-700">Available now</span></> : isTempOut ? <><span className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-amber-700">Out of stock temporarily</span></> : <><span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-red-600">Out of stock</span></>}
                        </button>
                      </td>
                      <td className="px-4 py-3"><div className="text-xs text-gray-500 whitespace-nowrap">{formatDate(product.createdAt)}</div></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <button onClick={() => void handleToggleStatus(product)} disabled={statusUpdatingId === product.id} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${product.status === "PUBLISHED" ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : "bg-green-600 text-white hover:bg-green-700"}`} title={product.status === "PUBLISHED" ? "Unpublish product" : "Approve & publish product"}>
                            {statusUpdatingId === product.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : product.status === "PUBLISHED" ? "Unpublish" : "Approve"}
                          </button>
                          <Link href={`/admin/products/${product.id}`} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="View Product"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/admin/products/${product.id}/edit`} className="p-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors" title="Edit Product"><Edit className="w-4 h-4" /></Link>
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Product"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm">No products found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {total > 0 && pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Showing <span className="font-medium">{startItem}</span> – <span className="font-medium">{endItem}</span> of <span className="font-medium">{total}</span></p>
            <div className="flex items-center space-x-1">
              <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || refreshing} aria-label="Previous page" className="flex items-center space-x-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"><ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Previous</span></button>
              <div className="hidden sm:flex items-center space-x-1">
                {pageNumbers.map((p, idx) => p === "..." ? <span key={`ellipsis-${idx}`} className="px-2 text-sm text-gray-400 select-none">…</span> : (
                  <button key={p} type="button" onClick={() => goToPage(p)} disabled={refreshing} aria-current={p === currentPage ? "page" : undefined} className={`min-w-[32px] h-8 px-2 text-sm rounded-lg transition-colors ${p === currentPage ? "bg-yellow-500 text-white font-semibold" : "text-gray-700 hover:bg-gray-100 border border-transparent hover:border-gray-200"} disabled:opacity-50 disabled:cursor-not-allowed`}>{p}</button>
                ))}
              </div>
              <span className="sm:hidden text-sm text-gray-600 px-2">{currentPage} / {pages}</span>
              <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pages || refreshing} aria-label="Next page" className="flex items-center space-x-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"><span className="hidden sm:inline">Next</span><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;