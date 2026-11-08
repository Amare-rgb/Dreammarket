"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { apiErrorText, useArticleCategories } from "@/lib/articleCategories";

export default function ArticleCategoriesPage() {
  const { categories, loading, error: loadError, create, remove } =
    useArticleCategories();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    setError("");
    setAdding(true);
    try {
      await create(value);
      setName("");
    } catch (e) {
      setError(apiErrorText(e, "Could not create the category."));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete the category "${label}"?`)) return;
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
          Create categories for your articles. A category can be deleted only when
          no article uses it.
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
          placeholder="New category name"
          aria-label="New category name"
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
        />
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
        ) : categories.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            No categories yet. Add your first one above.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.slug} · {c.count} article{c.count === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(c.id, c.name)}
                  disabled={c.count > 0 || deletingId === c.id}
                  title={c.count > 0 ? "In use by articles" : "Delete category"}
                  aria-label={`Delete ${c.name}`}
                  className="rounded-lg border border-slate-200 p-2 text-red-600 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}