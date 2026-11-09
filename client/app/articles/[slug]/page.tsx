"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, Eye, FileText, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import VideoPlayer from "@/components/VideoPlayer";
import {
  ArticleDetail,
  ArticleSummary,
  PublicCategory,
  categoryName,
  formatDate,
  readingMinutes,
} from "@/lib/publicArticles";

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [related, setRelated] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState("");
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);

  // Article fetch
  useEffect(() => {
    let active = true;

    api
      .get(`/api/articles/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!active) return;
        setArticle(res.data?.article || null);
        setError("");
        setLoadedSlug(slug);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setArticle(null);
        setError(
          (e as { response?: { status?: number } }).response?.status === 404
            ? "This article could not be found."
            : "This article could not be loaded. Please try again later."
        );
        setLoadedSlug(slug);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  // Categories fetch (for top nav)
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
          {error || "This article could not be found."}
        </p>
        <Link
          href="/articles"
          className="mt-5 inline-flex items-center gap-2 font-semibold text-[#cf5427]"
        >
          <ArrowLeft size={16} /> All articles
        </Link>
      </main>
    );
  }

  const label = categoryName(categories, article.category);

  return (
    <main className="min-h-screen bg-[var(--cream)] pb-20">
      {/* Top Navigation Bar */}
      <nav
        aria-label="Article categories"
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <ul className="flex min-w-max items-center gap-1 py-3">
            <li>
              <Link
                href="/articles"
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                All
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/articles?category=${c.slug}`}
                  aria-current={article.category === c.slug ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    article.category === c.slug
                      ? "bg-[#20283a] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* FULL SCREEN ARTICLE CONTAINER */}
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
        
        {/* Breadcrumb */}
        <p className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/articles" className="font-semibold text-[#cf5427] hover:underline">
            Articles
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
                <Clock size={13} /> {readingMinutes(article.content)} min read
              </span>
              {typeof article.views === "number" && (
                <span className="inline-flex items-center gap-1">
                  <Eye size={13} /> {article.views.toLocaleString()} views
                </span>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 border-b border-slate-100 pb-6 text-lg leading-7 text-slate-600">
              {article.description}
            </p>

            {/* Content */}
            <div className="whitespace-pre-wrap break-words py-6 text-base leading-8 text-slate-700">
              {article.content}
            </div>

            {/* Video */}
            {article.videoUrl && (
              <div className="pb-6">
                <VideoPlayer url={article.videoUrl} title={article.title} />
              </div>
            )}

            {/* Note */}
            {article.note && (
              <aside className="rounded-xl border-l-4 border-[#EB6D3D] bg-[#EB6D3D]/10 p-4 text-sm leading-6 text-slate-700">
                {article.note}
              </aside>
            )}

            {/* Comment Section */}
            <div id="comments" className="mt-8 border-t border-slate-100 pt-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Comments</h3>
              <p className="text-sm text-slate-500 mb-6">
                Your articles comment section goes here. If you have a dedicated comment component, place it inside this `div`.
              </p>
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#cf5427]"
              >
                <ArrowLeft size={16} /> Back to all articles
              </Link>
            </div>
          </div>
        </article>

        {/* Related Articles - Moved to Bottom (Full Width) */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold text-slate-900">More Articles</h2>
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
                      {item.title}
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
    </main>
  );
}