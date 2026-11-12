"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

type ApiError = { response?: { data?: { error?: string } } };

export const apiErrorText = (e: unknown, fallback: string) =>
  (e as ApiError | null | undefined)?.response?.data?.error ||
  (e instanceof Error ? e.message : fallback);

export const categoryLabel = (
  categories: ArticleCategory[],
  slug?: string | null
) => categories.find((c) => c.slug === slug)?.name ?? slug ?? "General";

export function useArticleCategories() {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/api/articles/admin/categories");
      setCategories(res.data?.categories || []);
    } catch (e) {
      setError(apiErrorText(e, "Could not load categories."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const create = useCallback(async (name: string) => {
    const res = await api.post("/api/articles/admin/categories", { name });
    const category = res.data?.category as ArticleCategory;
    setCategories((list) => [...list, category]);
    return category;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.delete(`/api/articles/admin/categories/${id}`);
    setCategories((list) => list.filter((c) => c.id !== id));
  }, []);

  return { categories, loading, error, reload, create, remove };
}