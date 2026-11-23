"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface PageLink {
  title: string;
  description: string;
  url: string;
}

interface SitePage {
  id: string | null;
  slug: string;
  title: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  body: string | null;
  links: PageLink[] | null;
  updatedAt: string | null;
}

const inputCls =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20";
const labelCls = "block text-sm font-semibold text-slate-700";

export default function AdminPagesPage() {
  const [pages, setPages] = useState<SitePage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [form, setForm] = useState({
    title: "",
    heroTitle: "",
    heroSubtitle: "",
    body: "",
  });
  const [links, setLinks] = useState<PageLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/api/admin/pages");
      const list: SitePage[] = res.data?.pages || [];
      setPages(list);
      setSelectedSlug((current) => current || list[0]?.slug || "");
    } catch {
      setError("Failed to load pages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const current = pages.find((p) => p.slug === selectedSlug) || null;

  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => {
      setForm({
        title: current.title || "",
        heroTitle: current.heroTitle || "",
        heroSubtitle: current.heroSubtitle || "",
        body: current.body || "",
      });
      setLinks(
        (current.links || []).map((l) => ({
          title: l.title || "",
          description: l.description || "",
          url: l.url || "",
        }))
      );
      setError("");
      setNotice("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [current]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlug) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put(`/api/admin/pages/${selectedSlug}`, {
        title: form.title,
        heroTitle: form.heroTitle,
        heroSubtitle: form.heroSubtitle,
        body: form.body,
        links: links.filter((l) => l.title.trim() && l.url.trim()),
      });
      setNotice("Page saved. It is now live on the website.");
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || "Failed to save page.");
    } finally {
      setSaving(false);
    }
  };

  const updateLink = (index: number, patch: Partial<PageLink>) => {
    setLinks((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#cf5427]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site Pages</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edit the content of the Training and Free Resources pages shown in the
          main navigation.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setSelectedSlug(p.slug)}
            className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
              selectedSlug === p.slug
                ? "bg-[#cf5427] text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {current && (
        <form
          onSubmit={save}
          className="grid gap-6 lg:grid-cols-[1fr_360px]"
        >
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileText size={18} className="text-[#cf5427]" />
              {current.title}
              <span className="text-xs font-normal text-slate-400">
                /{current.slug}
              </span>
            </h2>

            <label className={labelCls}>
              Page title
              <input
                required
                className={inputCls}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>

            <label className={labelCls}>
              Hero heading
              <input
                className={inputCls}
                value={form.heroTitle}
                onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
                placeholder={current.title}
              />
            </label>

            <label className={labelCls}>
              Hero subtitle
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20"
                value={form.heroSubtitle}
                onChange={(e) =>
                  setForm({ ...form, heroSubtitle: e.target.value })
                }
              />
            </label>

            <label className={labelCls}>
              Body content
              <textarea
                rows={8}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Main text shown below the hero. Leave empty to hide."
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Links &amp; cards
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setLinks((prev) => [
                      ...prev,
                      { title: "", description: "", url: "" },
                    ])
                  }
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Cards shown on the page. URL can be internal (/shop) or external.
              </p>
              <div className="mt-3 space-y-3">
                {links.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                    No links yet.
                  </p>
                )}
                {links.map((link, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <input
                      className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-[#cf5427]"
                      placeholder="Title"
                      value={link.title}
                      onChange={(e) => updateLink(i, { title: e.target.value })}
                    />
                    <input
                      className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-[#cf5427]"
                      placeholder="Description (optional)"
                      value={link.description}
                      onChange={(e) =>
                        updateLink(i, { description: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <input
                        className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-[#cf5427]"
                        placeholder="URL — /shop or https://…"
                        value={link.url}
                        onChange={(e) => updateLink(i, { url: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLinks((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove link"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-11 w-auto items-center justify-center gap-2 rounded-xl bg-[#cf5427] px-6 text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {saving ? "Saving…" : "Save Page"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
