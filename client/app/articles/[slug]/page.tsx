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
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Folder,
  FileText as FileIcon,
} from "lucide-react";
import { api } from "@/lib/api";
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

  // Track which sidebar category dropdown is open
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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

  // Auto-expand the sidebar category for the current article
  useEffect(() => {
    if (!article?.category || categories.length === 0) return;
    const slug = article.category;
    const parent = categories.find((c) =>
      c.subcategories?.some((s) => s.slug === slug)
    );
    const timer = window.setTimeout(() => {
      setExpandedCategory(parent ? parent.slug : slug);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [article?.category, categories]);

  // Related articles
  useEffect(() => {
    if (!article?.category) return;
    let active = true;
    api
      .get(`/api/articles?category=${encodeURIComponent(article.category)}`)
      .then((res) => {
        if (!active) return;
        const list: ArticleSummary[] = res.data?.articles || [];
        setRelated(list.filter((a) => a.slug !== article.slug).slice(0, 4));
      })
      .catch(() => {
        if (active) setRelated([]);
      });
    return () => {
      active = false;
    };
  }, [article?.category, article?.slug]);

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

  const toggleCategory = (slug: string) => {
    setExpandedCategory((prev) => (prev === slug ? null : slug));
  };

  return (
    <main className="min-h-screen bg-[var(--cream)] pb-20">
      {/* TWO-COLUMN LAYOUT: sidebar + article */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="flex gap-6">
          
          {/* SIDEBAR (Dropdown tree exactly like the image) */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-20">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Sidebar Header */}
                <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t("articles.categories_heading", "Categories")}
                  </h2>
                </div>

                <div className="p-2 space-y-0.5">
                  {/* All Articles Button */}
                  <Link
                    href="/articles"
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-white bg-[#111827] hover:bg-[#1f2937] transition"
                  >
                    <FileIcon size={16} className="text-white" />
                    {t("articles.all_articles", "All Articles")}
                  </Link>

                  {/* Category List */}
                  {categories.map((c) => {
                    const subs = c.subcategories || [];
                    const isExpanded = expandedCategory === c.slug;
                    const isActive =
                      article.category === c.slug ||
                      subs.some((s) => s.slug === article.category);

                    return (
                      <div key={c.id} className="flex flex-col">
                        {/* Category Row */}
                        <div
                          className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${
                            isActive ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <button
                            onClick={() => toggleCategory(c.slug)}
                            className="flex flex-1 items-center gap-2 py-1 outline-none"
                          >
                            {/* Chevron Arrow */}
                            <ChevronRight
                              size={14}
                              className={`text-slate-400 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                            <Folder size={16} className="text-slate-500" />
                            <span className="truncate">
                              {language === "am" && c.nameAm ? c.nameAm : c.name}
                            </span>
                          </button>
                          
                          {/* Article Count */}
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            {c.count}
                          </span>
                        </div>

                        {/* Expanded Subcategories / Article links */}
                        {isExpanded && (
                          <div className="ml-8 mt-1 mb-1 space-y-1 border-l border-slate-200 pl-2">
                            {subs.map((sub) => (
                              <Link
                                key={sub.id}
                                href={`/articles?category=${sub.slug}`}
                                className={`block rounded-md px-2 py-1 text-xs transition ${
                                  article.category === sub.slug
                                    ? "bg-[#EB6D3D]/10 font-semibold text-[#9c3d1a]"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                }`}
                              >
                                {language === "am" && sub.nameAm ? sub.nameAm : sub.name}
                              </Link>
                            ))}
                            <Link
                              href={`/articles?category=${c.slug}`}
                              className="block rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            >
                              {t("articles.view_all_in", "View all in")} {language === "am" && c.nameAm ? c.nameAm : c.name}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN ARTICLE */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb */}
            <p className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
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

            {/* Main Article */}
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Feature Image */}
              {article.image && (
                <Image
                  src={article.image}
                  alt=""
                  width={1400}
                  height={800}
                  unoptimized
                  className="max-h-[30rem] w-full object-cover"
                />
              )}

              <div className="p-6 sm:p-10">
                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span className="rounded-full bg-[#EB6D3D]/15 px-3 py-1 font-bold uppercase tracking-wide text-[#9c3d1a]">
                    {label}
                  </span>
                  <span>{formatDate(article.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} /> {readingMinutes(content)} {t("articles.min_read", "min read")}
                  </span>
                  {typeof article.views === "number" && (
                    <span className="inline-flex items-center gap-1">
                      <Eye size={13} /> {article.views.toLocaleString()} {t("articles.views", "views")}
                    </span>
                  )}
                </div>

                <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-4 border-b border-slate-100 pb-6 text-lg leading-7 text-slate-600">
                  {description}
                </p>

                {/* Content */}
                <div className="whitespace-pre-wrap break-words py-6 text-base leading-8 text-slate-700">
                  <LinkifyText text={content} />
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
              </div>
            </article>

            {/* Related Articles - Full Width below the article */}
            {related.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-4 text-xl font-bold text-slate-900">
                  {t("articles.more_articles", "More Articles")}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {related.map((item) => (
                    <Link
                      key={item.id}
                      href={`/articles/${item.slug}`}
                      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          width={400}
                          height={250}
                          unoptimized
                          className="h-32 w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-slate-400">
                          <FileText size={24} />
                        </div>
                      )}
                      <div className="p-4">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#cf5427]">
                          {localizedTitle(item, language)}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}