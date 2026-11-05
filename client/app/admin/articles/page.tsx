"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import ArticleForm from "./ArticleForm";

interface Article {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string | null;
  published: boolean;
  updatedAt: string;
}

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState<{
    sent: boolean;
    text: string;
  } | null>(null);
  const [sendingArticleId, setSendingArticleId] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/articles/admin");
      setArticles(response.data?.articles || []);
    } catch (requestError) {
      setError(
        (requestError as { response?: { data?: { error?: string } } }).response
          ?.data?.error || "Could not load articles."
      );
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

  const deleteArticle = async (article: Article) => {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/api/articles/admin/${article.id}`);
      setArticles((current) =>
        current.filter((entry) => entry.id !== article.id)
      );
    } catch (requestError) {
      setError(
        (requestError as { response?: { data?: { error?: string } } }).response
          ?.data?.error || "Could not delete the article."
      );
    }
  };

  const sendArticleToTelegram = async (article: Article) => {
    setSendingArticleId(article.id);
    setTelegramMessage(null);
    try {
      const response = await api.post(
        `/api/articles/admin/${article.id}/telegram`
      );
      const telegram = response.data?.telegram;
      setTelegramMessage({
        sent: Boolean(telegram?.sent),
        text: telegram?.sent
          ? telegram.warning
            ? `"${article.title}" text was sent, but the image could not be sent: ${telegram.warning}`
            : `"${article.title}" image and content were sent to Telegram.`
          : telegram?.error || "The Telegram announcement could not be sent.",
      });
    } catch (requestError) {
      const responseError = (
        requestError as { response?: { data?: { error?: string } } }
      ).response?.data?.error;
      setTelegramMessage({
        sent: false,
        text:
          responseError ||
          (requestError instanceof Error
            ? requestError.message
            : "The Telegram announcement could not be sent."),
      });
    } finally {
      setSendingArticleId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#cf5427]">Content management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Articles</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and publish marketplace articles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white"
        >
          <Plus size={17} /> Add article
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {telegramMessage && (
        <p
          role={telegramMessage.sent ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm ${
            telegramMessage.sent
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {telegramMessage.text}
        </p>
      )}

      {createOpen && (
        <ArticleForm
          onClose={() => setCreateOpen(false)}
          onSaved={(result) => {
            setCreateOpen(false);
            if (result.telegram) {
              setTelegramMessage({
                sent: result.telegram.sent,
                text: result.telegram.sent
                  ? result.telegram.warning
                    ? `Article published and text sent to Telegram, but its image could not be sent: ${result.telegram.warning}`
                    : "Article published and its image and content sent to Telegram."
                  : `Article published on the site, but Telegram could not be notified: ${
                      result.telegram.error || "Unknown Telegram error."
                    } Retry the send from the article row.`,
              });
            }
            void loadArticles();
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
          </div>
        ) : articles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No articles yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add your first article to publish marketplace updates and guides.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {articles.map((article) => (
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
                  <h2 className="font-semibold text-slate-900">{article.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {article.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    /articles/{article.slug} · Updated{" "}
                    {new Date(article.updatedAt).toLocaleDateString()}
                  </p>
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
                      onClick={() => void sendArticleToTelegram(article)}
                      disabled={sendingArticleId !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send size={15} />
                      {sendingArticleId === article.id
                        ? "Sending..."
                        : "Send to Telegram"}
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
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
