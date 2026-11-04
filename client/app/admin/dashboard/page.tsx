// app/admin/dashboard/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import { Download, RefreshCw, Package } from "lucide-react";

// ============================================================
// Types
// ============================================================
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  stock?: number;
  sku?: string;
  images?: string[];
  category?: { name: string; slug?: string } | null;
  createdAt: string;
}

interface StatsData {
  stats: {
    products: number;
    customers: number;
    orders: number | null;
    pendingOrders: number | null;
    salesRevenue: number | null;
    articles: number | null;
  };
  unavailableStats: string[];
  recentProducts: Product[];
}

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

// ============================================================
// Axios instance
// ============================================================
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("authToken");
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
// Stats Card
// ============================================================
const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle }) => {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 transition-shadow duration-200 hover:shadow-md">
      <div className="flex-1">
        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {title}
        </p>
        <p className="mt-0.5 text-xl font-bold leading-tight text-gray-900">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-[10px] leading-4 text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Helpers
// ============================================================
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// ✅ Cloudinary-only — returns null if no valid URL
const resolveCloudinaryUrl = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;

  return null;
};

const getProductImage = (product: Product): string | null => {
  if (Array.isArray(product.images) && product.images.length > 0) {
    for (const img of product.images) {
      const url = resolveCloudinaryUrl(img);
      if (url) return url;
    }
  }
  return null;
};

const getCategoryName = (product: Product): string => {
  if (!product.category) return "Uncategorized";
  return product.category.name || "Uncategorized";
};

const getDisplayPrice = (product: Product): number => {
  if (
    typeof product.discountPrice === "number" &&
    product.discountPrice > 0
  ) {
    return product.discountPrice;
  }
  return product.price;
};

// ============================================================
// Main component
// ============================================================
export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hasInitializedRef = useRef(false);

  const getAuthenticatedUser = useCallback((): User | null => {
    const token =
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken");
    const userData =
      localStorage.getItem("user") || sessionStorage.getItem("user");

    if (!token) return null;
    if (!userData) return null;

    try {
      const parsedUser = JSON.parse(userData) as User;
      if (parsedUser.role?.toUpperCase() !== "ADMIN") return null;
      return parsedUser;
    } catch (e) {
      console.error("Error parsing user data:", e);
      return null;
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const token =
        localStorage.getItem("authToken") ||
        sessionStorage.getItem("authToken");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await api.get("/api/admin/dashboard");

      if (!isMountedRef.current) return;

      if (response.data && response.data.stats) {
        const normalised: StatsData = {
          stats: {
            products: response.data.stats.products || 0,
            customers: response.data.stats.customers || 0,
            orders: response.data.stats.orders ?? null,
            pendingOrders: response.data.stats.pendingOrders ?? null,
            salesRevenue: response.data.stats.salesRevenue ?? null,
            articles: response.data.stats.articles ?? null,
          },
          unavailableStats: Array.isArray(response.data.unavailableStats)
            ? response.data.unavailableStats
            : [],
          recentProducts: Array.isArray(response.data.recentProducts)
            ? response.data.recentProducts
            : [],
        };
        setData(normalised);
        setError(null);
      } else {
        setError("Invalid data format from API");
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ error: string }>;
        if (
          axiosError.response?.status === 401 ||
          axiosError.response?.status === 403
        ) {
          localStorage.removeItem("authToken");
          sessionStorage.removeItem("authToken");
          router.replace("/auth/signin");
          return;
        }
        setError(
          axiosError.response?.data?.error || "Failed to fetch dashboard data"
        );
      } else {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const authenticatedUser = getAuthenticatedUser();
    if (!authenticatedUser) {
      router.replace("/auth/signin");
      return;
    }

    setTimeout(() => {
      setUser(authenticatedUser);
      fetchDashboardData();
    }, 0);
  }, [getAuthenticatedUser, fetchDashboardData, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB6D3D] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-[#EB6D3D] text-[#20283a] rounded-lg hover:bg-[#cf5427] hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No data available</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-[#EB6D3D] text-[#20283a] rounded-lg hover:bg-[#cf5427] hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const { stats, unavailableStats, recentProducts } = data;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500">
            Welcome back, {user?.name || "Admin"}!
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
          <button
            onClick={fetchDashboardData}
            className="flex items-center space-x-2 px-3 py-1.5 text-xs text-[#20283a] bg-[#EB6D3D] rounded-lg hover:bg-[#cf5427] hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Marketplace overview */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <StatsCard title="Total Products" value={stats.products} />
        <StatsCard title="Total Customers" value={stats.customers} />
        <StatsCard
          title="Total Orders"
          value={stats.orders ?? "Unavailable"}
        />
        <StatsCard
          title="Orders to process"
          value={stats.pendingOrders ?? "Unavailable"}
        />
        <StatsCard
          title="Sales revenue"
          value={
            stats.salesRevenue === null
              ? "Unavailable"
              : `ETB ${formatCurrency(stats.salesRevenue)}`
          }
        />
        <StatsCard title="Articles" value={stats.articles ?? "Unavailable"} />
      </div>
      {unavailableStats.length > 0 && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Order and article metrics are unavailable because their database
          tables are not installed ({unavailableStats.join(", ")}). Resolve the
          Prisma migration baseline and apply the pending migration to enable
          them.
        </div>
      )}

      {/* Recent Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Recent Products
            </h3>
            <p className="text-xs text-gray-500">
              Latest products added to your store
            </p>
          </div>
          <Package className="w-4 h-4 text-gray-400" />
        </div>
        <div className="overflow-x-auto">
          {recentProducts.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentProducts.map((product) => {
                  const img = getProductImage(product);
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center space-x-3">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt={product.name}
                              className="w-9 h-9 rounded-lg object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <span className="font-medium text-gray-900">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getCategoryName(product)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(getDisplayPrice(product))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {typeof product.stock === "number"
                          ? product.stock
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(product.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No products found</p>
              <p className="text-gray-400 text-xs mt-1">
                Add your first product to see it here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}