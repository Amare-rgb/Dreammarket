// app/admin/products/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  ChevronDown,
  Package,
  RefreshCw,
  XCircle,
  AlertCircle,
  CheckCircle,
  Info,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ProductCreateModal from "./ProductCreateModal";

// ============================================================
// API base
// ============================================================
const RAW_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000";
const API_URL = RAW_API_BASE.replace(/\/+$/, "");

// ============================================================
// Image URL resolver — Cloudinary ONLY
//   • Full https URL      → as-is
//   • res.cloudinary.com  → prefixed with https://
//   • Anything else       → null (let caller show placeholder icon)
// ============================================================
function resolveImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // Full URL (Cloudinary or external)
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // Cloudinary URL missing the scheme (defensive)
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  // Anything else (legacy /uploads/... path or stray filename) → no image
  return null;
}

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
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/auth/signin";
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// Types
// ============================================================
interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: Category | null;
  subCategory?: Category | null;
  price: number;
  discountPrice?: number;
  salePrice?: number;
  stock: number;
  sku: string;
  images: string[];
  tags: string[];
  brand?: string;
  weight?: number;
  unitOfMeasurement?: string;
  pricePerUnit?: number;
  durationTime?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationProps {
  type: "success" | "error" | "info" | "warning";
  message: string;
  onClose: () => void;
}

// ============================================================
// Notification
// ============================================================
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
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
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
        return "bg-emerald-50 border-emerald-200 text-emerald-800";
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
// Product thumbnail with fallback (inline SVG placeholder)
// ============================================================
const ProductImage: React.FC<{
  src: string | null;
  alt: string;
  className?: string;
}> = ({ src, alt, className = "" }) => {
  const [error, setError] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setError(false);
  }

  if (!src || error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${className}`}
      >
        <ImageIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={48}
      height={48}
      className={`object-cover ${className}`}
      onError={() => setError(true)}
      unoptimized
    />
  );
};

// ============================================================
// Pagination helper
// ============================================================
function getPageNumbers(
  current: number,
  totalPages: number
): (number | "...")[] {
  const pages: (number | "...")[] = [];
  const maxVisible = 5;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  pages.push(1);

  const start = Math.max(2, current - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages - 1, start + maxVisible - 1);

  if (start > 2) pages.push("...");

  for (let i = start; i <= end; i++) pages.push(i);

  if (end < totalPages - 1) pages.push("...");

  pages.push(totalPages);

  return pages;
}

// ============================================================
// Main component
// ============================================================
const ProductsPage: React.FC = () => {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const isMounted = useRef(true);
  const hasFetchedInitial = useRef(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const tableTopRef = useRef<HTMLDivElement>(null);

  const currentPageRef = useRef(currentPage);
  const searchQueryRef = useRef(searchQuery);
  const selectedCategoryRef = useRef(selectedCategory);
  const pageSizeRef = useRef(pageSize);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);
  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const showNotification = (
    type: "success" | "error" | "info" | "warning",
    message: string
  ) => setNotification({ type, message });

  const clearNotification = () => setNotification(null);

  const getToken = () =>
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken");

  const scrollToTableTop = () => {
    tableTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get("/api/categories/admin/all");
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.categories || [];
      if (isMounted.current) setCategories(data);
    } catch (err) {
      console.log("Categories fetch error:", err);
    }
  }, []);

  const fetchProducts = useCallback(
    async (opts?: {
      silent?: boolean;
      page?: number;
      search?: string;
      category?: string;
    }) => {
      const silent = opts?.silent ?? false;
      const page = opts?.page ?? currentPageRef.current;
      const search = opts?.search ?? searchQueryRef.current;
      const category = opts?.category ?? selectedCategoryRef.current;

      try {
        if (!silent) setRefreshing(true);

        const token = getToken();
        if (!token) {
          showNotification(
            "error",
            "Authentication required. Please login again."
          );
          router.push("/auth/signin");
          return;
        }

        const params = new URLSearchParams();
        params.append("page", String(page));
        params.append("limit", String(pageSizeRef.current));
        if (search) params.append("search", search);
        if (category) params.append("categoryId", category);

        const url = `/api/products/admin/all?${params.toString()}`;

        const response = await api.get(url);

        if (!isMounted.current) return;

        const list: Product[] = response.data?.products ?? [];
        const totalCount = response.data?.total ?? list.length;
        const totalPages = response.data?.pages ?? 1;

        setProducts(list);
        setTotal(totalCount);
        setPages(totalPages);
      } catch (err: unknown) {
        if (!isMounted.current) return;
        if (axios.isAxiosError(err)) {
          const axiosError = err as AxiosError<{ error: string }>;
          if (
            axiosError.response?.status === 401 ||
            axiosError.response?.status === 403
          ) {
            showNotification(
              "error",
              "Authentication failed. Please login again."
            );
            router.push("/auth/signin");
          } else {
            showNotification(
              "error",
              axiosError.response?.data?.error || "Failed to fetch products"
            );
          }
        } else {
          showNotification("error", "An unexpected error occurred");
        }
      } finally {
        if (isMounted.current) {
          setRefreshing(false);
          setInitialLoading(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    isMounted.current = true;

    if (!hasFetchedInitial.current) {
      hasFetchedInitial.current = true;

      const token = getToken();
      if (!token) {
        router.replace("/auth/signin");
        return;
      }

      const t = setTimeout(() => {
        void Promise.all([fetchCategories(), fetchProducts()]);
      }, 0);

      return () => {
        clearTimeout(t);
        isMounted.current = false;
        if (searchDebounceRef.current)
          clearTimeout(searchDebounceRef.current);
      };
    }

    return () => {
      isMounted.current = false;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      if (currentPageRef.current !== 1) {
        setCurrentPage(1);
      }
      fetchProducts({ silent: true, page: 1, search: searchQuery });
    }, 500);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, fetchProducts]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (currentPageRef.current !== 1) {
        setCurrentPage(1);
      }
      fetchProducts({
        silent: true,
        page: 1,
        category: selectedCategory,
      });
    }, 0);

    return () => clearTimeout(t);
  }, [selectedCategory, fetchProducts]);

  const goToPage = (page: number) => {
    if (page < 1 || page > pages || page === currentPage || refreshing) return;
    setCurrentPage(page);
    void fetchProducts({ silent: true, page });
    scrollToTableTop();
  };

  const handlePrevious = () => goToPage(currentPage - 1);
  const handleNext = () => goToPage(currentPage + 1);

  const handleRefresh = () => {
    void fetchProducts({ page: currentPage });
  };

  const handleProductCreated = () => {
    setShowCreateModal(false);
    setCurrentPage(1);
    showNotification("success", "Product created successfully.");
    void fetchProducts({ page: 1 });
  };

  const handleClearFilters = () => {
    setSelectedCategory("");
    setSearchQuery("");
    setCurrentPage(1);
    void fetchProducts({ silent: true, page: 1, search: "", category: "" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const token = getToken();
      if (!token) {
        showNotification("error", "Authentication required");
        return;
      }

      const response = await api.delete(`/api/products/${id}`);
      if (response.data.success) {
        showNotification("success", "Product deleted successfully!");

        if (products.length === 1 && currentPage > 1) {
          const prevPage = currentPage - 1;
          setCurrentPage(prevPage);
          await fetchProducts({ silent: true, page: prevPage });
        } else {
          await fetchProducts({ silent: true, page: currentPage });
        }
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      if (axios.isAxiosError(err)) {
        showNotification(
          "error",
          err.response?.data?.error || "Failed to delete product"
        );
      }
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "ETB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Cloudinary-only resolver — returns null if not a valid URL
  const getFirstImage = (
    images: string[] | null | undefined
  ): string | null => {
    if (!images || images.length === 0) return null;
    for (const img of images) {
      if (img && img.trim() !== "") {
        const url = resolveImage(img);
        if (url) return url;
      }
    }
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
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={clearNotification}
        />
      )}
      {showCreateModal && (
        <ProductCreateModal
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleProductCreated}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your product inventory
          </p>
          <p className="text-xs text-gray-400 mt-1">Total: {total} products</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-3 py-1.5 bg-[#EB6D3D] text-white rounded-lg hover:bg-[#cf5427] transition-colors text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Search + filters row */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showFilters ? "rotate-180" : ""
              }`}
            />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-[#EB6D3D] rounded-lg hover:bg-[#cf5427] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            >
              <option value="">All Categories</option>
              {categories
                .filter((cat) => !cat.parentId)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        ref={tableTopRef}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden relative"
      >
        {refreshing && (
          <div className="absolute inset-0 bg-white/40 flex items-start justify-center pt-6 pointer-events-none z-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-yellow-500 border-t-transparent" />
          </div>
        )}

        <div className="overflow-x-auto">
          {products.length > 0 ? (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => {
                  const imageUrl = getFirstImage(product.images);
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3 whitespace-nowrap">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200">
                            <ProductImage
                              src={imageUrl}
                              alt={product.name}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="flex flex-col">
                            <p className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">
                              {product.name}
                            </p>
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <span>SKU: {product.sku || "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {product.category?.name || "Uncategorized"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center whitespace-nowrap space-x-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(product.price)}
                          </span>
                          {product.discountPrice &&
                            product.discountPrice > 0 && (
                              <span className="text-xs text-yellow-600 font-medium">
                                (Disc: {formatCurrency(product.discountPrice)})
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-medium ${
                            product.stock === 0
                              ? "text-red-600"
                              : product.stock < 10
                              ? "text-yellow-600"
                              : "text-gray-900"
                          }`}
                        >
                          {product.stock || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(product.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Product"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="p-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
              <p className="text-xs text-gray-400 mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 0 && pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{startItem}</span> –{" "}
              <span className="font-medium">{endItem}</span> of{" "}
              <span className="font-medium">{total}</span>
            </p>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={currentPage === 1 || refreshing}
                aria-label="Previous page"
                className="flex items-center space-x-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <div className="hidden sm:flex items-center space-x-1">
                {pageNumbers.map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-sm text-gray-400 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      disabled={refreshing}
                      aria-current={p === currentPage ? "page" : undefined}
                      className={`min-w-[32px] h-8 px-2 text-sm rounded-lg transition-colors ${
                        p === currentPage
                          ? "bg-yellow-500 text-white font-semibold"
                          : "text-gray-700 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <span className="sm:hidden text-sm text-gray-600 px-2">
                {currentPage} / {pages}
              </span>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentPage >= pages || refreshing}
                aria-label="Next page"
                className="flex items-center space-x-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;