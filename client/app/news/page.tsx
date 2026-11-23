"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
  Play,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";

interface NewsItem {
  id: string;
  date: string;
  company: string;
  headline: string;
  summary: string | null;
  url: string | null;
}

interface VideoRelease {
  id: string;
  series: string;
  episodeNumber: number | null;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string;
}

interface PopularArticle {
  id: string;
  title: string;
  url: string;
  period: string;
  rank: number;
}

const NEWSLETTER_TYPES = [
  { value: "news", label: "Media Industry News" },
  { value: "videos", label: "Video Releases" },
  { value: "articles", label: "Popular Articles" },
  { value: "webinars", label: "Webinars" },
];

const PAGE_SIZES = [10, 25, 50];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [videos, setVideos] = useState<VideoRelease[]>([]);
  const [articles7, setArticles7] = useState<PopularArticle[]>([]);
  const [articles30, setArticles30] = useState<PopularArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // News table state
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Newsletter form state
  const [nlForm, setNlForm] = useState({ firstName: "", lastName: "", email: "" });
  const [nlTypes, setNlTypes] = useState<string[]>(["news"]);
  const [nlSubmitting, setNlSubmitting] = useState(false);
  const [nlMessage, setNlMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/api/media/news"),
      api.get("/api/media/videos"),
      api.get("/api/media/popular-articles", { params: { period: "LAST_7_DAYS" } }),
      api.get("/api/media/popular-articles", { params: { period: "LAST_30_DAYS" } }),
    ])
      .then(([n, v, a7, a30]) => {
        if (cancelled) return;
        setNews(n.data?.items || []);
        setVideos(v.data?.items || []);
        setArticles7(a7.data?.items || []);
        setArticles30(a30.data?.items || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredNews = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return news;
    return news.filter(
      (item) =>
        item.company.toLowerCase().includes(q) ||
        item.headline.toLowerCase().includes(q) ||
        (item.summary || "").toLowerCase().includes(q)
    );
  }, [news, search]);

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = filteredNews.slice(start, start + pageSize);

  const toggleType = (value: string) => {
    setNlTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setNlMessage(null);
    if (!nlForm.firstName.trim() || !nlForm.lastName.trim() || !nlForm.email.trim()) {
      setNlMessage({ ok: false, text: "Please fill in all fields." });
      return;
    }
    if (nlTypes.length === 0) {
      setNlMessage({ ok: false, text: "Select at least one newsletter type." });
      return;
    }
    setNlSubmitting(true);
    try {
      await api.post("/api/media/newsletter/subscribe", {
        firstName: nlForm.firstName,
        lastName: nlForm.lastName,
        email: nlForm.email,
        types: nlTypes,
      });
      setNlMessage({ ok: true, text: "Thanks for subscribing! Check your inbox." });
      setNlForm({ firstName: "", lastName: "", email: "" });
      setNlTypes(["news"]);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setNlMessage({ ok: false, text: msg || "Subscription failed. Please try again." });
    } finally {
      setNlSubmitting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, safePage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  }, [safePage, totalPages]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#f7f4ef]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-slate-900">
      {/* Hero */}
      <section className="bg-[#20283a] px-5 py-16 text-center text-white sm:py-20">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffad72]">
          Media Industry News
        </p>
        <h1 className="text-4xl font-bold sm:text-5xl">Latest Industry Updates</h1>
        <p className="mx-auto mt-4 max-w-2xl text-white/70">
          Company news, video releases, and the articles everyone is reading.
        </p>
      </section>

      {/* News table */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Media Industry News</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search news…"
                  className="h-9 w-56 rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-[#F47822]"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                Show
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-[#F47822]"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                entries
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Latest News</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-slate-500">
                      No news items found.
                    </td>
                  </tr>
                )}
                {pageItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{item.company}</td>
                    <td className="px-5 py-3">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#d75e18] hover:underline"
                        >
                          {item.headline}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-800">{item.headline}</span>
                      )}
                      {item.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.summary}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
            <span>
              Showing {filteredNews.length === 0 ? 0 : start + 1} to{" "}
              {Math.min(start + pageSize, filteredNews.length)} of{" "}
              {filteredNews.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
                aria-label="First page"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 1}
                className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`h-8 w-8 rounded-lg text-sm font-semibold ${
                    n === safePage
                      ? "bg-[#cf5427] text-white"
                      : "hover:bg-slate-100"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Last page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="rounded-2xl bg-[#20283a] p-8 text-white shadow-lg sm:p-10">
          <h2 className="text-2xl font-bold">Edit Smarter Newsletter</h2>
          <p className="mt-2 text-sm text-white/70">
            Get the latest media industry news and resources delivered to your inbox.
          </p>
          <form onSubmit={subscribe} className="mt-6 grid gap-4 sm:grid-cols-2">
            <input
              required
              value={nlForm.firstName}
              onChange={(e) => setNlForm({ ...nlForm, firstName: e.target.value })}
              placeholder="First Name"
              className="h-11 rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-white placeholder-white/50 outline-none focus:border-[#F47822]"
            />
            <input
              required
              value={nlForm.lastName}
              onChange={(e) => setNlForm({ ...nlForm, lastName: e.target.value })}
              placeholder="Last Name"
              className="h-11 rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-white placeholder-white/50 outline-none focus:border-[#F47822]"
            />
            <input
              required
              type="email"
              value={nlForm.email}
              onChange={(e) => setNlForm({ ...nlForm, email: e.target.value })}
              placeholder="Email Address"
              className="h-11 rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-white placeholder-white/50 outline-none focus:border-[#F47822] sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                Subscribe to
              </p>
              <div className="flex flex-wrap gap-3">
                {NEWSLETTER_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 transition hover:border-[#F47822]"
                  >
                    <input
                      type="checkbox"
                      checked={nlTypes.includes(t.value)}
                      onChange={() => toggleType(t.value)}
                      className="accent-[#F47822]"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            {nlMessage && (
              <p
                className={`sm:col-span-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                  nlMessage.ok ? "bg-green-500/20 text-green-200" : "bg-red-500/20 text-red-200"
                }`}
              >
                {nlMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={nlSubmitting}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#F47822] px-6 text-sm font-bold text-white transition hover:bg-[#df6417] disabled:opacity-60 sm:col-span-2 sm:w-auto"
            >
              {nlSubmitting && <LoaderCircle size={15} className="animate-spin" />}
              {nlSubmitting ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        </div>
      </section>

      {/* Videos + Popular articles */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-bold text-slate-900">Newest Video Releases</h2>
          <div className="space-y-4">
            {videos.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No video releases yet.
              </p>
            )}
            {videos.slice(0, 6).map((v) => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-[#20283a] text-white">
                  <Play size={22} className="fill-current" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#cf5427]">
                    {v.series}
                    {v.episodeNumber != null ? ` · Ep. ${v.episodeNumber}` : ""}
                  </p>
                  <h3 className="mt-1 truncate font-bold text-slate-900 group-hover:text-[#d75e18]">
                    {v.title}
                  </h3>
                  {v.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{v.summary}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">{formatDate(v.publishedAt)}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {[
            { title: "Popular Articles — Last 7 Days", items: articles7 },
            { title: "Popular Articles — Last 30 Days", items: articles30 },
          ].map((section) => (
            <div key={section.title}>
              <h2 className="mb-4 text-xl font-bold text-slate-900">{section.title}</h2>
              <ol className="space-y-2">
                {section.items.length === 0 && (
                  <li className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                    No articles yet.
                  </li>
                )}
                {section.items.map((a, i) => (
                  <li key={a.id}>
                    <a
                      href={a.url}
                      target={a.url.startsWith("http") ? "_blank" : undefined}
                      rel={a.url.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#e0a83c]/60 hover:shadow"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#20283a] text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                        {a.title}
                      </span>
                      <ArrowUpRight size={15} className="shrink-0 text-slate-400" />
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        <Link href="/articles" className="font-semibold text-[#d75e18] hover:underline">
          Browse all articles →
        </Link>
      </section>
    </main>
  );
}
