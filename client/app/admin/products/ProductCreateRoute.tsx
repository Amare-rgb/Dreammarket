"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import ProductCreateModal from "./ProductCreateModal";

interface ProductCategory {
  id: string;
  name: string;
  parentId?: string | null;
}

export default function ProductCreateRoute() {
  const router = useRouter();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/api/categories/admin/all")
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.categories || [];
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setError("Categories could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="mt-4 h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductCreateModal
      categories={categories}
      onClose={() => router.push("/admin/products")}
      onCreated={() => router.push("/admin/products")}
    />
  );
}
