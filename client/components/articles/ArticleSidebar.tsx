"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Folder, FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicCategory } from "@/lib/publicArticles";

interface ArticleSidebarProps {
  activeCategory?: string;
  onCategorySelect?: (slug: string) => void;
}

export default function ArticleSidebar({ activeCategory = "all", onCategorySelect }: ArticleSidebarProps) {
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get("/api/articles/categories")
      .then((res) => {
        if (active) {
          setCategories(res.data?.categories || []);
          // Auto-expand the active category
          if (activeCategory !== "all") {
            setExpandedCategories(new Set([activeCategory]));
          }
        }
      })
      .catch(() => {
        if (active) setCategories([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeCategory]);

  const toggleCategory = (slug: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  const handleCategoryClick = (slug: string) => {
    if (onCategorySelect) {
      onCategorySelect(slug);
    }
  };

  if (loading) {
    return (
      <div className="w-64 bg-white border-r border-slate-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Categories
        </h3>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {/* All Articles */}
          <li>
            <Link
              href="/articles"
              onClick={() => handleCategoryClick("all")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeCategory === "all"
                  ? "bg-[#20283a] text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <FileText size={16} />
              <span>All Articles</span>
            </Link>
          </li>

          {/* Categories */}
          {categories.map((category) => {
            const isExpanded = expandedCategories.has(category.slug);
            const isActive = activeCategory === category.slug;

            return (
              <li key={category.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.slug)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <Link
                    href={`/articles?category=${category.slug}`}
                    onClick={() => handleCategoryClick(category.slug)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? "bg-[#20283a] text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Folder size={16} />
                    <span className="flex-1">{category.name}</span>
                    <span className={`text-xs ${isActive ? "text-white/70" : "text-slate-400"}`}>
                      {category.count}
                    </span>
                  </Link>
                </div>

                {/* Subcategories (if any) */}
                {isExpanded && category.subcategories && category.subcategories.length > 0 && (
                  <ul className="ml-6 mt-1 space-y-1">
                    {category.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={`/articles?category=${sub.slug}`}
                          onClick={() => handleCategoryClick(sub.slug)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                            activeCategory === sub.slug
                              ? "bg-[#EB6D3D]/10 text-[#9c3d1a] font-medium"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <FileText size={14} />
                          <span className="flex-1">{sub.name}</span>
                          <span className="text-xs text-slate-400">{sub.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          {categories.length} categories
        </p>
      </div>
    </aside>
  );
}
