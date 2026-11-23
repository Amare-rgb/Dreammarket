"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Eye,
  FileText,
  LoaderCircle,
  Maximize,
  MessageSquare,
  Minimize,
  Play,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { getVideoSource } from "@/lib/video";
import VideoPlayer from "@/components/VideoPlayer";
import { LinkifyText } from "@/components/LinkifyText";
import ArticleComments from "@/components/articles/ArticleComments";
import {
  ArticleDetail,
  ArticleSummary,
  PublicCategory,
  categoryName,
  formatDate,
  localizedContent,
  localizedDescription,
  localizedNote,
  localizedTitle,
  readingMinutes,
} from "@/lib/publicArticles";
import { useLanguage } from "@/context/LanguageContext";

// YouTube videos get an automatic thumbnail when the article has no image.
function youtubeThumbnail(videoUrl: string) {
  const source = getVideoSource(videoUrl);
  if (source?.kind !== "iframe") return null;
  const id = source.src.match(/youtube-nocookie\.com\/embed\/([\w-]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { language, t } = useLanguage();

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [related, setRelated] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState("");
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);

  // Comments hidden by default
  const [showComments, setShowComments] = useState(false);

  // Which category dropdown is expanded in the left sidebar
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Focus mode: hides sidebars and shows only the article
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => setIsFullscreen((v) => !v);

  // Article fetch
  useEffect(() => {
    let active = true;

    api
      .get(`/api/articles/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!active) return;
        const fetchedArticle = res.data?.article || null;
        setArticle(fetchedArticle);
        setError("");
        setLoadedSlug(slug);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setArticle(null);
        setError(
          (e as { response?: { status?: number } }).response?.status === 404
            ? t("articles.not_found", "This article could not be found.")
            : t("articles.articles_load_failed", "This article could not be loaded. Please try again later.")
        );
        setLoadedSlug(slug);
      });

    return () => {
      active = false;
    };
  }, [slug, t]);

  // Categories fetch (for sidebar + top nav)
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

  // Auto-expand the dropdown containing the current article's category
  useEffect(() => {
    if (!article?.category || categories.length === 0) return;
    const slug = article.category;
    const parent = categories.find((c) =>
      c.subcategories?.some((s) => s.slug === slug)
    );
    const timer = window.setTimeout(() => {
      setOpenCategory(parent ? parent.slug : slug);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [article?.category, categories]);

  // Latest articles for the sidebar feed
  useEffect(() => {
    if (!article) return;
    let active = true;
    api
      .get("/api/articles")
      .then((res) => {
        if (!active) return;
        const list: ArticleSummary[] = res.data?.articles || [];
        setRelated(list.filter((a) => a.slug !== article.slug).slice(0, 8));
      })
      .catch(() => {
        if (active) setRelated([]);
      });
    return () => {
      active = false;
    };
  }, [article]);

  const loading = loadedSlug !== slug;

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[var(--cream)]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </main>
    );
  }

  if (!article) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
        <p role="alert" className="text-slate-600">
          {error || t("articles.not_found", "This article could not be found.")}
        </p>
        <Link
          href="/articles"
          className="mt-5 inline-flex items-center gap-2 font-semibold text-[#cf5427]"
        >
          <ArrowLeft size={16} /> {t("articles.all_articles", "All articles")}
        </Link>
      </main>
    );
  }

  const label = categoryName(categories, article.category, language);
  const title = localizedTitle(article, language);
  const description = localizedDescription(article, language);
  const content = localizedContent(article, language);
  const note = localizedNote(article, language);
  const paragraphs = (
    content.split(/\n{2,}/).some((p) => p.trim().length > 0)
      ? content.split(/\n{2,}/)
      : content.split(/\n/)
  ).filter((p) => p.trim().length > 0);
  const featuredThumb =
    article.image ||
    (article.videoUrl ? youtubeThumbnail(article.videoUrl) : null);

  return (
    <main className="min-h-screen bg-white pb-20">
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="flex gap-5">
          {/* Left categories sidebar — narrow, near screen edge */}
          <aside className={isFullscreen ? "hidden" : "hidden w-40 shrink-0 xl:block"}>
            <div className="sticky top-24">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                {t("articles.categories_heading", "Categories")}
              </h2>
              <ul className="mt-3 space-y-1">
                <li>
                  <Link
                    href="/articles"
                    className="block rounded-md px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {t("articles.all_articles", "All Articles")}
                  </Link>
                </li>
                {categories.map((c) => {
                  const subs = c.subcategories || [];
                  const isOpen = openCategory === c.slug;
                  const active =
                    article.category === c.slug ||
                    subs.some((s) => s.slug === article.category);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setOpenCategory(isOpen ? null : c.slug)}
                        aria-expanded={isOpen}
                        className={`flex w-full items-center justify-between gap-1 rounded-md px-2 py-1.5 text-xs transition ${
                          active
                            ? "bg-[#EB6D3D]/10 font-bold text-[#9c3d1a]"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <ChevronRight
                            size={12}
                            className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                          <span className="truncate">
                            {language === "am" && c.nameAm ? c.nameAm : c.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">{c.count}</span>
                      </button>
                      {isOpen && (
                        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                          <li>
                            <Link
                              href={`/articles?category=${c.slug}`}
                              className={`block rounded px-1.5 py-1 text-[11px] transition ${
                                article.category === c.slug
                                  ? "font-bold text-[#9c3d1a]"
                                  : "text-slate-500 hover:text-slate-900"
                              }`}
                            >
                              {t("articles.view_all_in", "All in")}{" "}
                              {language === "am" && c.nameAm ? c.nameAm : c.name}
                            </Link>
                          </li>
                          {subs.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                href={`/articles?category=${sub.slug}`}
                                className={`flex items-center justify-between gap-1 rounded px-1.5 py-1 text-[11px] transition ${
                                  article.category === sub.slug
                                    ? "font-bold text-[#9c3d1a]"
                                    : "text-slate-500 hover:text-slate-900"
                                }`}
                              >
                                <span className="truncate">
                                  {language === "am" && sub.nameAm ? sub.nameAm : sub.name}
                                </span>
                                <span className="text-[10px] text-slate-400">{sub.count}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          <div className={`grid min-w-0 flex-1 grid-cols-1 gap-6 ${isFullscreen ? "" : "lg:grid-cols-12"}`}>
          {/* MAIN READING COLUMN */}
          <article className={isFullscreen ? "mx-auto w-full max-w-5xl" : "lg:col-span-8"}>
            {/* Breadcrumb + fullscreen */}
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/articles"
                  className="font-semibold text-[#cf5427] hover:underline"
                >
                  {t("articles.breadcrumb_articles", "Articles")}
                </Link>
                <span>/</span>
                <Link
                  href={`/articles?category=${article.category || "general"}`}
                  className="hover:underline"
                >
                  {label}
                </Link>
              </p>
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen
                    ? t("articles.exit_fullscreen", "Exit fullscreen")
                    : t("articles.fullscreen", "Fullscreen")
                }
                title={
                  isFullscreen
                    ? t("articles.exit_fullscreen", "Exit fullscreen")
                    : t("articles.fullscreen", "Fullscreen")
                }
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-[#EB6D3D] hover:text-[#cf5427]"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </button>
            </div>

            {/* Headline */}
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              {title}
            </h1>

            {/* Meta line */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <Link
                href={`/articles?category=${article.category || "general"}`}
                className="font-bold uppercase tracking-wide text-[#cf5427] hover:underline"
              >
                {label}
              </Link>
              <span>{formatDate(article.createdAt)}</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={14} /> {readingMinutes(content)} {t("articles.min_read", "min read")}
              </span>
              {typeof article.views === "number" && (
                <span className="inline-flex items-center gap-1">
                  <Eye size={14} /> {article.views.toLocaleString()} {t("articles.views", "views")}
                </span>
              )}
            </div>

            {description && (
              <p className="mt-4 text-lg leading-7 text-slate-600">{description}</p>
            )}

            {/* Featured image */}
            {featuredThumb && (
              <div className="mt-6 overflow-hidden">
                <Image
                  src={featuredThumb}
                  alt=""
                  width={1200}
                  height={675}
                  unoptimized
                  className="aspect-[16/9] w-full object-cover"
                />
              </div>
            )}

            {/* Body */}
            <div className="mt-8 space-y-5 text-base leading-relaxed text-gray-800 md:text-lg">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-wrap break-words">
                  <LinkifyText text={p} />
                </p>
              ))}
            </div>

                {/* Note */}
                {note && (
                  <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                      {t("articles.note", "Note")}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-amber-900">
                      {note}
                    </p>
                  </div>
                )}

                {/* Video */}
                {article.videoUrl && (
                  <div className="pb-6">
                    <VideoPlayer url={article.videoUrl} title={title} />
                  </div>
                )}

                {/* PDF attachment */}
                {article.pdfUrl && (
                  <div className="pb-6">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#9c3d1a]">
                        <FileText size={16} /> {t("articles.attached_pdf", "Attached PDF")}
                      </h2>
                      <a
                        href={article.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#20283a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#2e3a52]"
                      >
                        {t("articles.open_pdf", "Open / Download PDF")}
                      </a>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <iframe
                        src={article.pdfUrl}
                        title={`${title} PDF`}
                        className="h-[32rem] w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Second Note */}
                {note && (
                  <aside className="rounded-xl border-l-4 border-[#EB6D3D] bg-[#EB6D3D]/10 p-4 text-sm leading-6 text-slate-700">
                    {note}
                  </aside>
                )}

                {/* Comment Section — hidden by default, toggle button */}
                <div id="comments" className="mt-8 border-t border-slate-100 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
                      <MessageSquare size={18} /> {t("articles.comments", "Comments")}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowComments((v) => !v)}
                      aria-expanded={showComments}
                      aria-controls="comments-panel"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#cf5427]"
                    >
                      {showComments ? (
                        <>
                          {t("articles.hide_comments", "Hide comments")} <ChevronUp size={16} />
                        </>
                      ) : (
                        <>
                          {t("articles.show_comments", "Show comments")} <ChevronDown size={16} />
                        </>
                      )}
                    </button>
                  </div>

                  {showComments && (
                    <div id="comments-panel" className="mt-5">
                      <ArticleComments slug={slug} />
                    </div>
                  )}

                  <Link
                    href="/articles"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#cf5427]"
                  >
                    <ArrowLeft size={16} /> {t("articles.back_to_all", "Back to all articles")}
                  </Link>
                </div>
          </article>

          {/* Sidebar: Latest / More Articles */}
          <aside className={isFullscreen ? "hidden" : "border-t border-slate-200 pt-6 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              {t("articles.more_articles", "Latest / More Articles")}
            </h2>
            {related.length > 0 ? (
              <ul className="mt-4 space-y-5">
                {related.map((item) => {
                  const thumb =
                    item.image ||
                    (item.videoUrl ? youtubeThumbnail(item.videoUrl) : null);
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/articles/${item.slug}`}
                        className="group flex gap-3"
                      >
                        <div className="relative h-20 w-28 shrink-0 overflow-hidden bg-slate-100">
                          {thumb ? (
                            <Image
                              src={thumb}
                              alt=""
                              fill
                              unoptimized
                              className="object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-300">
                              <FileText size={18} />
                            </div>
                          )}
                          {item.videoUrl && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 shadow">
                                <Play size={13} className="ml-0.5 text-white" fill="white" />
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-3 text-sm font-bold leading-snug text-slate-900 group-hover:text-[#cf5427]">
                            {localizedTitle(item, language)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                {t("articles.no_more", "No more articles yet.")}
              </p>
            )}
          </aside>
          </div>
        </div>
      </div>
    </main>
  );
}