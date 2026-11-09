"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle, Search, Video, X, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import VideoPlayer from "@/components/VideoPlayer";
import {
  ArticleDetail,
  ArticleSummary,
  PublicCategory,
  categoryName,
  formatDate,
} from "@/lib/publicArticles";

const LOGO_SRC = "/banners/photo.jpg";
const HERO_VIDEO_SRC = "/banners/adpp_is.mp4";
const MAX_COMMENT_LENGTH = 1000;

interface ArticleComment {
  id: string | number;
  name: string;
  message: string;
  createdAt: string;
}

function LogoPlaceholder({
  className = "",
  size = 64,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#EB6D3D]/10 to-slate-100 ${className}`}
    >
      <Image
        src={LOGO_SRC}
        alt="Dream More"
        width={size * 2}
        height={size * 2}
        unoptimized
        className="object-contain opacity-90"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

function ArticlesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") || "all";
  const urlSearch = searchParams.get("search") || "";

  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState<string | null>(null);
  const query = searchInput !== null ? searchInput : urlSearch;

  const [selected, setSelected] = useState<ArticleSummary | null>(null);
  const [preview, setPreview] = useState<ArticleDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Comments
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const commentsRef = useRef<HTMLElement>(null);
  const wantsComments = useRef(false);

  // Categories
  useEffect(() => {
    let active = true;
    api
      .get("/api/articles/categories")
      .then((res) => {
        if (active) setCategories(res.data?.categories || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Articles for the active category
  useEffect(() => {
    let active = true;
    const params =
      activeCategory === "all" ? "" : `?category=${encodeURIComponent(activeCategory)}`;
    api
      .get(`/api/articles${params}`)
      .then((res) => {
        if (!active) return;
        setArticles(res.data?.articles || []);
        setError("");
      })
      .catch(() => {
        if (active) setError("Articles could not be loaded. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeCategory]);

  // Quick preview content
  useEffect(() => {
    if (!selected) return;
    let active = true;
    api
      .get(`/api/articles/${encodeURIComponent(selected.slug)}`)
      .then((res) => {
        if (active) setPreview(res.data?.article || null);
      })
      .catch(() => {
        if (active) setPreviewError("This article preview could not be loaded.");
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  // Comments for the selected article (inside modal)
  useEffect(() => {
    if (!selected) return;
    let active = true;
    api
      .get(`/api/articles/${encodeURIComponent(selected.slug)}/comments`)
      .then((res) => {
        if (active) setComments(res.data?.comments || []);
      })
      .catch(() => {
        if (active) setCommentsError("Comments could not be loaded.");
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  // Jump to the comments section when the preview was opened with "Comment"
  useEffect(() => {
    if (!selected || previewLoading || !wantsComments.current) return;
    wantsComments.current = false;
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected, previewLoading]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const chooseCategory = (slug: string) => {
    if (slug === activeCategory) return;
    setLoading(true);
    setSearchInput(null);

    const params = new URLSearchParams();
    if (slug !== "all") params.set("category", slug);
    if (urlSearch) params.set("search", urlSearch);

    const qs = params.toString();
    router.push(`/articles${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const handleInlineSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();

    const params = new URLSearchParams();
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (q) params.set("search", q);

    const qs = params.toString();
    router.push(`/articles${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const openPreview = (article: ArticleSummary, goToComments = false) => {
    wantsComments.current = goToComments;
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(true);
    setComments([]);
    setCommentsError("");
    setCommentsLoading(true);
    setCommentName("");
    setCommentMessage("");
    setSubmitError("");
    setSubmitNotice("");
    setSelected(article);
  };

  const submitComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected || submitting) return;

    const name = commentName.trim();
    const message = commentMessage.trim();
    if (!name || !message) {
      setSubmitError("Please enter your name and a comment.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitNotice("");
    try {
      const res = await api.post(
        `/api/articles/${encodeURIComponent(selected.slug)}/comments`,
        { name, message }
      );
      const created: ArticleComment | undefined = res.data?.comment;
      if (created) {
        setComments((prev) => [created, ...prev]);
        setSubmitNotice("Thank you! Your comment has been posted.");
      } else {
        setSubmitNotice("Thank you! Your comment was submitted and will appear after review.");
      }
      setCommentMessage("");
    } catch {
      setSubmitError("Your comment could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const filtered = useMemo(() => {
    const q = urlSearch.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [articles, urlSearch]);

  const showFeatured = !urlSearch.trim() && filtered.length > 0;
  const featured = showFeatured ? filtered[0] : null;
  const rest = showFeatured ? filtered.slice(1) : filtered;
  const activeName =
    activeCategory === "all" ? "All articles" : categoryName(categories, activeCategory);

  return (
    <main className="min-h-screen bg-[var(--cream)] pb-20">
      {/* Immersive Centered Hero with background video */}
      <section className="relative isolate flex min-h-[75vh] items-center justify-center overflow-hidden bg-[#20283a] px-5 py-24 text-center text-white sm:px-8 sm:py-32 lg:min-h-[80vh]">
        <video
          src={HERO_VIDEO_SRC}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 -z-10 bg-black/60" />

        <div className="relative mx-auto w-full max-w-4xl">
          <p className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#F47822] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F47822] animate-pulse" />
            Dream More Affiliate Market
          </p>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
            Dream More Articles
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow sm:text-lg">
            Discover marketplace news, in-depth product guides, and useful business updates curated directly by Dream More.
          </p>
        </div>
      </section>

      {/* Navigation Toolbar (Sticky) */}
      <nav
        aria-label="Article categories"
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Categories */}
          <div className="flex-1 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-1">
              <li>
                <button
                  type="button"
                  onClick={() => chooseCategory("all")}
                  aria-current={activeCategory === "all" ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeCategory === "all"
                      ? "bg-[#20283a] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All <span className="ml-1 opacity-70">{totalCount}</span>
                </button>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => chooseCategory(c.slug)}
                    aria-current={activeCategory === c.slug ? "page" : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeCategory === c.slug
                        ? "bg-[#20283a] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {c.name} <span className="ml-1 opacity-70">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Inline Search */}
          <form onSubmit={handleInlineSearch} className="relative w-full shrink-0 sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search..."
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-[#EB6D3D] focus:bg-white focus:ring-2 focus:ring-[#EB6D3D]/20"
            />
          </form>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {urlSearch ? `Search results for "${urlSearch}"` : activeName}
          </h2>
          {!loading && (
            <p className="text-sm text-slate-500">
              {filtered.length} article{filtered.length === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
          </div>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
            <Image
              src={LOGO_SRC}
              alt="Dream More"
              width={160}
              height={160}
              unoptimized
              className="mx-auto h-20 w-20 object-contain opacity-80"
            />
            <h3 className="mt-3 font-semibold text-slate-800">No articles found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {urlSearch
                ? "Try a different search word."
                : "Please check back soon for marketplace updates and guides."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured */}
            {featured && (
              <article className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-xl lg:grid-cols-2">
                {/* Featured Media: Shows Video if exists, else Image */}
                <div className="relative block h-64 lg:h-full min-h-[300px] bg-slate-900">
                  {featured.videoUrl ? (
                    <VideoPlayer url={featured.videoUrl} title={featured.title} />
                  ) : featured.image ? (
                    <Link href={`/articles/${featured.slug}`} className="block h-full w-full">
                      <Image
                        src={featured.image}
                        alt=""
                        width={1000}
                        height={620}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </Link>
                  ) : (
                    <Link href={`/articles/${featured.slug}`} className="block h-full w-full">
                      <LogoPlaceholder className="h-full w-full" size={96} />
                    </Link>
                  )}
                </div>

                <div className="flex flex-col justify-center p-6 sm:p-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#EB6D3D]/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#9c3d1a]">
                      {categoryName(categories, featured.category)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(featured.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                    <Link href={`/articles/${featured.slug}`} className="hover:text-[#cf5427]">
                      {featured.title}
                    </Link>
                  </h3>
                  <p className="mt-3 line-clamp-4 text-base leading-7 text-slate-600">
                    {featured.description}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/articles/${featured.slug}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#cf5427]"
                    >
                      Read article <ArrowRight size={16} />
                    </Link>

                    <button
                      type="button"
                      onClick={() => openPreview(featured)}
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Quick preview
                    </button>

                    {/* Comment Button (Featured) - Opens Full Screen Page */}
                    <Link
                      href={`/articles/${featured.slug}#comments`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <MessageSquare size={16} /> Comment
                    </Link>
                  </div>
                </div>
              </article>
            )}

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rest.map((article) => (
                  <article
                    key={article.id}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#EB6D3D]/50 hover:shadow-xl"
                  >
                    {/* Media: Shows Video if exists, else Image */}
                    <div className="relative block bg-slate-900 h-44">
                      {article.videoUrl ? (
                        <VideoPlayer url={article.videoUrl} title={article.title} />
                      ) : article.image ? (
                        <Link href={`/articles/${article.slug}`} className="block h-full w-full">
                          <Image
                            src={article.image}
                            alt=""
                            width={700}
                            height={420}
                            unoptimized
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        </Link>
                      ) : (
                        <Link href={`/articles/${article.slug}`} className="block h-full w-full">
                          <LogoPlaceholder className="h-full w-full" size={72} />
                        </Link>
                      )}
                      
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#cf5427] shadow-sm z-10">
                        {categoryName(categories, article.category)}
                      </span>
                      {article.videoUrl && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#20283a]/85 px-2 py-1 text-[11px] font-bold text-white shadow-sm z-10">
                          <Video size={12} /> Video
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-xs text-slate-400">{formatDate(article.createdAt)}</p>
                      <h3 className="mt-1.5 text-lg font-bold leading-snug text-slate-900">
                        <Link href={`/articles/${article.slug}`} className="hover:text-[#cf5427]">
                          {article.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                        {article.description}
                      </p>
                      
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-slate-100 mt-4">
                        {/* Comment Button (Grid) - Opens Full Screen Page */}
                        <Link
                          href={`/articles/${article.slug}#comments`}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-[#cf5427]"
                        >
                          <MessageSquare size={15} /> Comment
                        </Link>

                        <Link
                          href={`/articles/${article.slug}`}
                          className="inline-flex items-center gap-1 text-sm font-bold text-[#cf5427] transition hover:text-[#9c3d1a]"
                        >
                          Read <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quick preview Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="article-preview-title"
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close article preview"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-700 shadow transition hover:bg-white hover:text-slate-950"
            >
              <X size={20} />
            </button>
            {selected.image ? (
              <Image
                src={selected.image}
                alt=""
                width={1200}
                height={600}
                unoptimized
                className="h-52 w-full object-cover sm:h-64"
              />
            ) : (
              <LogoPlaceholder className="h-40" size={80} />
            )}
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#cf5427]">
                {categoryName(categories, selected.category)} · {formatDate(selected.createdAt)}
              </p>
              <h2
                id="article-preview-title"
                className="mt-2 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl"
              >
                {selected.title}
              </h2>
              <p className="mt-4 border-b border-slate-100 pb-5 text-base leading-7 text-slate-600">
                {selected.description}
              </p>

              {previewLoading ? (
                <div className="flex min-h-32 items-center justify-center">
                  <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
                </div>
              ) : previewError ? (
                <p role="alert" className="py-6 text-sm text-red-700">
                  {previewError}
                </p>
              ) : preview ? (
                <>
                  <div className="whitespace-pre-wrap break-words py-5 text-sm leading-7 text-slate-700">
                    {preview.content}
                  </div>
                  {(preview.videoUrl || selected.videoUrl) && (
                    <div className="pb-5">
                      <VideoPlayer
                        url={(preview.videoUrl || selected.videoUrl) as string}
                        title={preview.title}
                      />
                    </div>
                  )}
                  {preview.note && (
                    <aside className="rounded-xl border-l-4 border-[#EB6D3D] bg-[#EB6D3D]/10 p-4 text-sm leading-6 text-slate-700">
                      {preview.note}
                    </aside>
                  )}
                </>
              ) : null}

              {/* Comments */}
              <section
                ref={commentsRef}
                aria-labelledby="article-comments-title"
                className="mt-8 border-t border-slate-100 pt-6"
              >
                <h3
                  id="article-comments-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Comments{!commentsLoading && ` (${comments.length})`}
                </h3>

                <form onSubmit={submitComment} className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="comment-name"
                      className="mb-1 block text-sm font-semibold text-slate-700"
                    >
                      Your name
                    </label>
                    <input
                      id="comment-name"
                      value={commentName}
                      onChange={(e) => setCommentName(e.target.value)}
                      maxLength={80}
                      autoComplete="name"
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/30"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="comment-message"
                      className="mb-1 block text-sm font-semibold text-slate-700"
                    >
                      Your comment
                    </label>
                    <textarea
                      id="comment-message"
                      value={commentMessage}
                      onChange={(e) => setCommentMessage(e.target.value)}
                      maxLength={MAX_COMMENT_LENGTH}
                      rows={4}
                      className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/30"
                    />
                    <p className="mt-1 text-right text-xs text-slate-400">
                      {commentMessage.length}/{MAX_COMMENT_LENGTH}
                    </p>
                  </div>

                  {submitError && (
                    <p role="alert" className="text-sm text-red-700">
                      {submitError}
                    </p>
                  )}
                  {submitNotice && (
                    <p role="status" className="text-sm text-emerald-700">
                      {submitNotice}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#cf5427] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && <LoaderCircle size={16} className="animate-spin" />}
                    {submitting ? "Posting..." : "Post comment"}
                  </button>
                </form>

                <div className="mt-6">
                  {commentsLoading ? (
                    <div className="flex min-h-20 items-center justify-center">
                      <LoaderCircle className="h-6 w-6 animate-spin text-[#F47822]" />
                    </div>
                  ) : commentsError ? (
                    <p role="alert" className="text-sm text-red-700">
                      {commentsError}
                    </p>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No comments yet. Be the first to comment.
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {comments.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {c.message}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close preview
                </button>
                <Link
                  href={`/articles/${selected.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#cf5427]"
                >
                  Open full article <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center bg-[var(--cream)]">
          <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
        </main>
      }
    >
      <ArticlesBrowser />
    </Suspense>
  );
}