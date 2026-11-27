"use client";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Folder,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  apiErrorText,
  useArticleCategories,
  type ArticleCategory,
} from "@/lib/articleCategories";

export default function ArticleCategoriesPage() {
  const { categories, loading, error: loadError, create, remove } =
    useArticleCategories();
  const [name, setName] = useState("");
  const [nameAm, setNameAm] = useState("");
  const [parentId, setParentId] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  
  const parents = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );
  const childrenOf = useMemo(() => {
    const map = new Map<string, ArticleCategory[]>();
    for (const c of categories) {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    return map;
  }, [categories]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    setError("");
    setAdding(true);
    try {
      const created = await create(value, parentId || null, nameAm.trim() || undefined);
      setName("");
      setNameAm("");
      setParentId("");
      if (created.parentId) {
        setExpanded((prev) => new Set(prev).add(created.parentId as string));
      }
    } catch (e) {
      setError(apiErrorText(e, "Could not create the category."));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    setError("");
    setDeletingId(id);
    try {
      await remove(id);
    } catch (e) {
      setError(apiErrorText(e, "Could not delete the category."));
    } finally {
      setDeletingId(null);
    }
  };

  const renderDeleteButton = (c: ArticleCategory) => {
    const children = childrenOf.get(c.id) || [];
    const blocked = children.length > 0 || c.count > 0;
    const reason =
      children.length > 0
        ? "Delete its subcategories first"
        : c.count > 0
          ? "In use by articles"
          : "Delete category";
    return (
      <button
        type="button"
        onClick={() => void handleDelete(c.id, c.name)}
        disabled={blocked || deletingId === c.id}
        title={reason}
        aria-label={`Delete ${c.name}`}
        className="rounded-lg border border-slate-200 p-2 text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={16} />
      </button>
    );
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to articles
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Article categories</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create categories and subcategories for your articles. A category can be
          deleted only when it has no subcategories and no articles use it.
        </p>
      </header>
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="New category name (English)"
          aria-label="New category name"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
        />
        <input
          value={nameAm}
          onChange={(e) => setNameAm(e.target.value)}
          maxLength={40}
          placeholder="ስም በአማርኛ (optional)"
          aria-label="New category name in Amharic"
          dir="rtl"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
        />
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          aria-label="Parent category (optional)"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
        >
          <option value="">Top-level category</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              Subcategory of: {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {adding ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          Add category
        </button>
      </form>

      {(error || loadError) && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error || loadError}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
          </div>
        ) : parents.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            No categories yet. Add your first one above.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {parents.map((c) => {
              const children = childrenOf.get(c.id) || [];
              const isOpen = expanded.has(c.id) || children.length > 0;
              return (
                <li key={c.id}>
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    {children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(c.id)}
                        aria-label={isOpen ? "Collapse subcategories" : "Expand subcategories"}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      >
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    ) : (
                      <span className="w-6" />
                    )}
                    <Folder size={16} className="shrink-0 text-[#EB6D3D]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {c.name}
                        {c.nameAm && (
                          <span className="ml-2 text-sm font-normal text-slate-500" dir="rtl">
                            {c.nameAm}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.slug} · {c.count} article{c.count === 1 ? "" : "s"}
                        {children.length > 0 &&
                          ` · ${children.length} subcategor${children.length === 1 ? "y" : "ies"}`}
                      </p>
                    </div>
                    {renderDeleteButton(c)}
                  </div>

                  {isOpen && children.length > 0 && (
                    <ul className="border-t border-slate-100 bg-slate-50/60">
                      {children.map((sub) => (
                        <li
                          key={sub.id}
                          className="flex items-center gap-3 py-2.5 pl-14 pr-4 sm:pl-16 sm:pr-5"
                        >
                          <span className="text-slate-300">└</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800">
                              {sub.name}
                              {sub.nameAm && (
                                <span className="ml-2 text-xs font-normal text-slate-500" dir="rtl">
                                  {sub.nameAm}
                                </span>
                              )}
                              <span className="ml-2 rounded-full bg-[#EB6D3D]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9c3d1a]">
                                Subcategory
                              </span>
                            </p>
                            <p className="text-xs text-slate-400">
                              {sub.slug} · {sub.count} article{sub.count === 1 ? "" : "s"}
                            </p>
                          </div>
                          {renderDeleteButton(sub)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}