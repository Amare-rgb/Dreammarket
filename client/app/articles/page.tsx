"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, LoaderCircle, X } from "lucide-react";
import { api } from "@/lib/api";

interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string | null;
  createdAt: string;
}

interface ArticlePreview extends ArticleSummary {
  content: string;
  note: string | null;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<ArticleSummary | null>(
    null
  );
  const [preview, setPreview] = useState<ArticlePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/api/articles")
      .then((response) => {
        if (active) setArticles(response.data?.articles || []);
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
  }, []);

  useEffect(() => {
    if (!selectedArticle) return;

    let active = true;
    api
      .get(`/api/articles/${encodeURIComponent(selectedArticle.slug)}`)
      .then((response) => {
        if (active) setPreview(response.data?.article || null);
      })
      .catch(() => {
        if (active) {
          setPreviewError("This article preview could not be loaded.");
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedArticle]);

  const openArticlePreview = (article: ArticleSummary) => {
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(true);
    setSelectedArticle(article);
  };

  useEffect(() => {
    if (!selectedArticle) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedArticle(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedArticle]);

  return (
    <main className="min-h-screen bg-[var(--cream)] pb-16">
      <section className="bg-[#20283a] px-5 py-16 text-white sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47822]">
            Dream More Affiliate Market
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Articles</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            Marketplace news, product guides, and useful updates from Dream More.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <FileText className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No articles published yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Please check back soon for marketplace updates and guides.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#EB6D3D]/50 hover:shadow-xl"
              >
                <div className="relative">
                  {article.image ? (
                    <Image
                      src={article.image}
                      alt=""
                      width={700}
                      height={420}
                      unoptimized
                      className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-gradient-to-br from-[#EB6D3D]/10 to-slate-100 text-[#F47822]/60">
                      <FileText size={42} strokeWidth={1.5} />
                    </div>
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#cf5427] shadow-sm">
                    Marketplace
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="text-xs text-slate-400">
                      {new Date(article.createdAt).toLocaleDateString()}
                    </p>
                    <h2 className="mt-1.5 text-xl font-bold leading-snug text-slate-900">
                      {article.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {article.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => openArticlePreview(article)}
                        className="rounded-lg border border-[#EB6D3D] px-4 py-2 text-sm font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EB6D3D] focus-visible:ring-offset-2"
                      >
                        Quick preview
                      </button>
                      <Link
                        href={`/articles/${article.slug}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#cf5427] transition hover:text-[#9c3d1a]"
                      >
                        Full article <ArrowRight size={16} />
                      </Link>
                    </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedArticle && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedArticle(null);
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
              onClick={() => setSelectedArticle(null)}
              aria-label="Close article preview"
              className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 text-slate-700 shadow transition hover:bg-white hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EB6D3D]"
            >
              <X size={20} />
            </button>
            {selectedArticle.image ? (
              <Image
                src={selectedArticle.image}
                alt=""
                width={1200}
                height={600}
                unoptimized
                className="h-52 w-full object-cover sm:h-64"
              />
            ) : (
              <div className="flex h-44 items-center justify-center bg-gradient-to-br from-[#EB6D3D]/10 to-slate-100 text-[#F47822]/60">
                <FileText size={44} strokeWidth={1.5} />
              </div>
            )}
            <div className="p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#cf5427]">
                {new Date(selectedArticle.createdAt).toLocaleDateString()}
              </p>
              <h2
                id="article-preview-title"
                className="mt-2 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl"
              >
                {selectedArticle.title}
              </h2>
              <p className="mt-4 border-b border-slate-100 pb-5 text-base leading-7 text-slate-600">
                {selectedArticle.description}
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
                  {preview.note && (
                    <aside className="rounded-xl border-l-4 border-[#EB6D3D] bg-[#EB6D3D]/10 p-4 text-sm leading-6 text-slate-700">
                      {preview.note}
                    </aside>
                  )}
                </>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close preview
                </button>
                <Link
                  href={`/articles/${selectedArticle.slug}`}
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
