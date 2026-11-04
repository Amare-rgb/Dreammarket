"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Article {
  title: string;
  description: string;
  content: string;
  note: string | null;
  image: string | null;
  createdAt: string;
}

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get(`/api/articles/${encodeURIComponent(params.slug)}`)
      .then((response) => {
        if (active) setArticle(response.data?.article || null);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            (requestError as { response?: { status?: number } }).response
              ?.status === 404
              ? "This article could not be found."
              : "This article could not be loaded. Please try again later."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.slug]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[var(--cream)]">
        <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
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

  return (
    <main className="min-h-screen bg-[var(--cream)] px-5 py-10 sm:px-8">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {article.image && (
          <Image
            src={article.image}
            alt=""
            width={1400}
            height={800}
            unoptimized
            className="max-h-[28rem] w-full object-cover"
          />
        )}
        <div className="p-6 sm:p-10">
          <Link
            href="/articles"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#cf5427]"
          >
            <ArrowLeft size={16} /> All articles
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#cf5427]">
            {new Date(article.createdAt).toLocaleDateString()}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-4 border-b border-slate-100 pb-6 text-lg leading-7 text-slate-600">
            {article.description}
          </p>
          <div className="whitespace-pre-wrap break-words py-6 text-base leading-8 text-slate-700">
            {article.content}
          </div>
          {article.note && (
            <aside className="rounded-xl border-l-4 border-[#EB6D3D] bg-[#EB6D3D]/10 p-4 text-sm leading-6 text-slate-700">
              {article.note}
            </aside>
          )}
        </div>
      </article>
    </main>
  );
}
