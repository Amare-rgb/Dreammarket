"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import ProductCreateModal from "./ProductCreateModal";

interface ProductCategory {
  id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
}

const PRODUCTS_LIST_PATH = "/admin/products";

export default function ProductCreateRoute() {
  const router = useRouter();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCategories = useCallback(async () => {
    try {
      // ✅ FIX: Add Cache-Control headers to force a fresh fetch from the database
      const response = await api.get("/api/categories/admin/all", {
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
      
      const data: ProductCategory[] = Array.isArray(response.data)
        ? response.data
        : response.data?.categories || [];
        
      setCategories(data);
      setError("");
    } catch {
      setError("Categories could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ FIX: Standard `ignore` pattern
  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!ignore) {
        await fetchCategories();
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [fetchCategories]);

  const goToProducts = () => router.push(PRODUCTS_LIST_PATH);

  const handleRetry = async () => {
    setError("");
    setLoading(true);
    await fetchCategories();
  };

  const handleCategoryDeleted = async () => {
    // Refresh the categories list if one is deleted
    await fetchCategories();
  };

  const handleCategoryAdded = async () => {
    // Refresh the categories list if one is created
    await fetchCategories();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#EB6D3D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={goToProducts}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back to products
            </button>
            <button
              type="button"
              onClick={() => void handleRetry()}
              className="h-10 rounded-lg bg-[#EB6D3D] px-4 text-sm font-semibold text-white transition hover:bg-[#cf5427]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProductCreateModal
      categories={categories}
      onClose={goToProducts}
      onCreated={goToProducts}
      onCategoryDeleted={handleCategoryDeleted}
      onCategoryAdded={handleCategoryAdded}
    />
  );
}