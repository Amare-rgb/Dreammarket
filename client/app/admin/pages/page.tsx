"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
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
  const [modalOpen, setModalOpen] = useState(false);

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
      setModalOpen(false);
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

      <div className="flex flex-wrap justify-center gap-5">
        {pages.map((p) => {
          const active = selectedSlug === p.slug;
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => {
                setSelectedSlug(p.slug);
                setModalOpen(true);
              }}
              className={`min-w-[160px] rounded-2xl border px-6 py-4 text-center transition ${
                active
                  ? "border-[#cf5427] bg-[#cf5427] text-white shadow-lg shadow-[#cf5427]/25"
                  : "border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-[#cf5427]/50 hover:shadow-md"
              }`}
            >
              <span className="block text-sm font-extrabold">{p.title}</span>
              <span className={`mt-1 block text-[11px] font-semibold ${active ? "text-white/80" : "text-slate-400"}`}>
                /{p.slug}
              </span>
            </button>
          );
        })}
      </div>

      {current && modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{current.title}</h2>
                <p className="mt-0.5 text-xs text-slate-400">/{current.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={save} className="space-y-4">
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
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Main text shown below the hero. Leave empty to hide."
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Links &amp; cards</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setLinks((prev) => [
                        ...prev,
                        { title: "", description: "", url: "" },
                      ])
                    }
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    Add link
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Cards shown on the page. URL can be internal (/shop) or external.
                </p>
                <div className="mt-3 space-y-3">
                  {links.length === 0 && (
                    <p className="rounded-lg bg-white px-3 py-4 text-center text-xs text-slate-400 ring-1 ring-slate-200">
                      No links yet.
                    </p>
                  )}
                  {links.map((link, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20"
                        placeholder="Title"
                        value={link.title}
                        onChange={(e) => updateLink(i, { title: e.target.value })}
                      />
                      <input
                        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20"
                        placeholder="Description (optional)"
                        value={link.description}
                        onChange={(e) =>
                          updateLink(i, { description: e.target.value })
                        }
                      />
                      <div className="flex gap-2">
                        <input
                          className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#cf5427] focus:ring-2 focus:ring-[#cf5427]/20"
                          placeholder="URL — /shop or https://…"
                          value={link.url}
                          onChange={(e) => updateLink(i, { url: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setLinks((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="shrink-0 rounded-lg px-3 text-xs font-bold text-red-600 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 rounded-xl px-5 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#cf5427] px-6 text-sm font-extrabold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60"
                >
                  {saving && <LoaderCircle size={15} className="animate-spin" />}
                  {saving ? "Saving…" : "Save Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
