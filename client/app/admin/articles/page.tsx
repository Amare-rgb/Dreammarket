"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Settings2,
  Trash2,
  Video,
} from "lucide-react";
import { api } from "@/lib/api";
import { getVideoSource } from "@/lib/video";
import {
  apiErrorText as errorText,
  categoryLabel,
  useArticleCategories,
} from "@/lib/articleCategories";
import VideoPlayer from "@/components/VideoPlayer";

interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  category?: string | null;
  image: string | null;
  videoUrl?: string | null;
  published: boolean;
  views?: number;
  updatedAt: string;
}

type Filter = "all" | "published" | "draft";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
];

export default function AdminArticlesPage() {
  const { categories } = useArticleCategories();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("all");
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/articles/admin");
      setArticles(res.data?.articles || []);
    } catch (e) {
      setError(errorText(e, "Could not load articles."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadArticles();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadArticles]);

  const stats = useMemo(() => {
    const published = articles.filter((a) => a.published).length;
    return {
      total: articles.length,
      published,
      drafts: articles.length - published,
      views: articles.reduce((sum, a) => sum + (a.views || 0), 0),
    };
  }, [articles]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of articles) {
      const key = a.category || "general";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [articles]);

  const visible = useMemo(
    () =>
      articles.filter((a) => {
        const statusOk =
          filter === "all" ? true : filter === "published" ? a.published : !a.published;
        const categoryOk = category === "all" || (a.category || "general") === category;
        return statusOk && categoryOk;
      }),
    [articles, filter, category]
  );

  const deleteArticle = async (article: Article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/articles/admin/${article.id}`);
      setArticles((list) => list.filter((a) => a.id !== article.id));
    } catch (e) {
      setError(errorText(e, "Could not delete the article."));
    }
  };

  const sendToTelegram = async (article: Article) => {
    setSendingId(article.id);
    setNotice(null);
    try {
      const res = await api.post(`/api/articles/admin/${article.id}/telegram`);
      const t = res.data?.telegram;
      setNotice({
        ok: Boolean(t?.sent),
        text: t?.sent
          ? t.warning
            ? `"${article.title}" text was sent, but the image could not be sent: ${t.warning}`
            : `"${article.title}" image and content were sent to Telegram.`
          : t?.error || "The Telegram announcement could not be sent.",
      });
    } catch (e) {
      setNotice({
        ok: false,
        text: errorText(e, "The Telegram announcement could not be sent."),
      });
    } finally {
      setSendingId(null);
    }
  };

  const cards = [
    { label: "Total articles", value: stats.total, tone: "text-slate-900" },
    { label: "Published", value: stats.published, tone: "text-emerald-700" },
    { label: "Drafts", value: stats.drafts, tone: "text-amber-700" },
    { label: "Total views", value: stats.views.toLocaleString(), tone: "text-sky-700" },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#cf5427]">Content management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Articles</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, manage and publish marketplace articles by category.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/articles/categories"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Settings2 size={16} /> Manage categories
          </Link>
          <Link
            href="/admin/articles/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white"
          >
            <Plus size={17} /> Add article
          </Link>
        </div>
      </header>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-0.5 text-xl font-bold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm ${
            notice.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                filter === f.key
                  ? "bg-[#20283a] text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              category === "all"
                ? "bg-[#EB6D3D] text-[#20283a]"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            All categories ({articles.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                category === c.slug
                  ? "bg-[#EB6D3D] text-[#20283a]"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {c.name} ({categoryCounts[c.slug] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No articles found</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add an article to publish marketplace updates and guides.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((article) => {
              const hasVideo = Boolean(
                article.videoUrl && getVideoSource(article.videoUrl)
              );
              const videoOpen = openVideoId === article.id;

              return (
                <article
                  key={article.id}
                  className="flex flex-wrap items-center gap-4 p-4 sm:p-5"
                >
                  {article.image ? (
                    <Image
                      src={article.image}
                      alt=""
                      width={96}
                      height={72}
                      unoptimized
                      className="h-16 w-24 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <FileText size={22} />
                    </div>
                  )}

                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#EB6D3D]/15 px-2.5 py-0.5 text-xs font-semibold text-[#9c3d1a]">
                        {categoryLabel(categories, article.category || "general")}
                      </span>
                      <h2 className="font-semibold text-slate-900">{article.title}</h2>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {article.description}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                      <span>/articles/{article.slug}</span>
                      <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} /> {(article.views || 0).toLocaleString()} views
                      </span>
                    </p>
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={() => setOpenVideoId(videoOpen ? null : article.id)}
                        aria-expanded={videoOpen}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
                      >
                        <Video size={13} /> {videoOpen ? "Hide video" : "Show video"}
                      </button>
                    )}
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      article.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {article.published ? "Published" : "Draft"}
                  </span>

                  <div className="flex items-center gap-2">
                    {article.published && (
                      <button
                        type="button"
                        onClick={() => void sendToTelegram(article)}
                        disabled={sendingId !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send size={15} />
                        {sendingId === article.id ? "Sending..." : "Send to Telegram"}
                      </button>
                    )}
                    <Link
                      href={`/admin/articles/${article.id}/edit`}
                      aria-label={`Edit ${article.title}`}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-[#EB6D3D] hover:text-[#9c3d1a]"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => void deleteArticle(article)}
                      aria-label={`Delete ${article.title}`}
                      className="rounded-lg border border-slate-200 p-2 text-red-600 transition hover:border-red-200 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {hasVideo && videoOpen && (
                    <div className="w-full basis-full">
                      <div className="max-w-2xl">
                        <VideoPlayer
                          url={article.videoUrl as string}
                          title={article.title}
                        />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}