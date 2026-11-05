"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, Save, X } from "lucide-react";
import { api, uploadApi } from "@/lib/api";

interface ArticleDraft {
  title: string;
  slug: string;
  description: string;
  content: string;
  image: string;
  note: string;
  published: boolean;
}

const emptyDraft: ArticleDraft = {
  title: "",
  slug: "",
  description: "",
  content: "",
  image: "",
  note: "",
  published: false,
};

interface ArticleFormProps {
  articleId?: string;
  onClose?: () => void;
  onSaved?: (result: ArticleSaveResult) => void;
}

interface ArticleSaveResult {
  articleId: string;
  telegram?: {
    sent: boolean;
    error?: string;
    warning?: string;
  };
}

export default function ArticleForm({
  articleId,
  onClose,
  onSaved,
}: ArticleFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  const [savedArticleId, setSavedArticleId] = useState(articleId);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{
    sent: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !uploading) {
        if (onClose) onClose();
        else router.push("/admin/articles");
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, router, saving, uploading]);

  useEffect(() => {
    if (!articleId) return;
    let active = true;
    api
      .get(`/api/articles/admin/${articleId}`)
      .then((response) => {
        const article = response.data?.article;
        if (!article) throw new Error("Article not found.");
        if (active) {
          setDraft({
            title: article.title || "",
            slug: article.slug || "",
            description: article.description || "",
            content: article.content || "",
            image: article.image || "",
            note: article.note || "",
            published: Boolean(article.published),
          });
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load article."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be 10 MB or less.");
      event.target.value = "";
      return;
    }

    setError("");
    setUploading(true);
    try {
      const response = await uploadApi.uploadArticleImage(file);
      if (!response.success || !response.url) {
        throw new Error("Image upload did not return an image URL.");
      }
      setDraft((current) => ({ ...current, image: response.url }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to upload article image."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setTelegramStatus(null);
    setSaving(true);
    try {
      const endpoint = savedArticleId
        ? `/api/articles/admin/${savedArticleId}`
        : "/api/articles/admin";
      const response = savedArticleId
        ? await api.put(endpoint, draft)
        : await api.post(endpoint, draft);
      const nextArticleId =
        response.data?.article?.id || savedArticleId;
      if (!nextArticleId) {
        throw new Error("The article was saved, but its ID was not returned.");
      }
      setSavedArticleId(nextArticleId);

      const telegram = response.data?.telegram as
        | ArticleSaveResult["telegram"]
        | undefined;
      if (telegram && !telegram.sent) {
        const message =
          telegram.error ||
          "The article was saved, but its Telegram announcement failed.";
        if (onSaved) {
          onSaved({ articleId: nextArticleId, telegram });
        } else {
          setTelegramStatus({ sent: false, message });
        }
        return;
      }

      if (onSaved) onSaved({ articleId: nextArticleId, telegram });
      else {
        router.push("/admin/articles");
        router.refresh();
      }
    } catch (requestError) {
      const responseError = (
        requestError as { response?: { data?: { error?: string } } }
      ).response?.data?.error;
      setError(
        responseError ||
          (requestError instanceof Error
            ? requestError.message
            : "Failed to save article.")
      );
    } finally {
      setSaving(false);
    }
  };

  const retryTelegramAnnouncement = async () => {
    if (!savedArticleId) return;
    setTelegramSending(true);
    setTelegramStatus(null);
    try {
      const response = await api.post(
        `/api/articles/admin/${savedArticleId}/telegram`
      );
      const telegram = response.data?.telegram;
      setTelegramStatus({
        sent: Boolean(telegram?.sent),
        message: telegram?.sent
          ? telegram.warning
            ? `Article text was sent, but its image could not be sent: ${telegram.warning}`
            : "Article image and content sent to Telegram."
          : telegram?.error || "The Telegram announcement could not be sent.",
      });
    } catch (requestError) {
      const responseError = (
        requestError as { response?: { data?: { error?: string } } }
      ).response?.data?.error;
      setTelegramStatus({
        sent: false,
        message:
          responseError ||
          (requestError instanceof Error
            ? requestError.message
            : "The Telegram announcement could not be sent."),
      });
    } finally {
      setTelegramSending(false);
    }
  };

  const update = (key: keyof ArticleDraft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !saving &&
          !uploading
        ) {
          if (onClose) onClose();
          else router.push("/admin/articles");
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-form-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h1
              id="article-form-title"
              className="text-xl font-bold text-slate-900"
            >
              {savedArticleId ? "Edit article" : "Add an article"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Add article details and publish when ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else router.push("/admin/articles");
            }}
            disabled={saving || uploading}
            aria-label="Close article form"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </header>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
            <div className="space-y-4 p-5 sm:p-6">
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              {telegramStatus && (
                <div
                  role={telegramStatus.sent ? "status" : "alert"}
                  className={`rounded-xl border p-3 text-sm ${
                    telegramStatus.sent
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <p>{telegramStatus.message}</p>
                  {!telegramStatus.sent &&
                    savedArticleId &&
                    draft.published && (
                      <button
                        type="button"
                        onClick={() => void retryTelegramAnnouncement()}
                        disabled={telegramSending}
                        className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-60"
                      >
                        {telegramSending ? "Sending..." : "Retry Telegram send"}
                      </button>
                    )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Article title *
                  <input
                    value={draft.title}
                    onChange={(event) => update("title", event.target.value)}
                    required
                    maxLength={180}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  URL slug (optional)
                  <input
                    value={draft.slug}
                    onChange={(event) => update("slug", event.target.value)}
                    placeholder="generated-from-title"
                    maxLength={100}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Short description *
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  required
                  maxLength={1000}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Article content *
                <textarea
                  value={draft.content}
                  onChange={(event) => update("content", event.target.value)}
                  required
                  rows={6}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal leading-6 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Paragraph breaks are preserved on the public article page.
                </span>
              </label>

              <div>
                <span className="block text-sm font-semibold text-slate-700">
                  Article image
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  {draft.image ? (
                    <Image
                      src={draft.image}
                      alt="Article cover preview"
                      width={160}
                      height={100}
                      unoptimized
                      className="h-20 w-32 rounded-xl border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                      <ImagePlus size={22} />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl border border-[#EB6D3D]/40 px-4 py-2 text-sm font-semibold text-[#9c3d1a] transition hover:bg-[#EB6D3D]/10 disabled:opacity-60"
                    >
                      {uploading ? "Uploading image..." : "Upload image"}
                    </button>
                    {draft.image && (
                      <button
                        type="button"
                        onClick={() => update("image", "")}
                        className="text-left text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Additional note (shown with the published article)
                <textarea
                  value={draft.note}
                  onChange={(event) => update("note", event.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                />
              </label>

              <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    update("published", event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 accent-[#EB6D3D]"
                />
                <span>
                  <span className="block font-semibold">Publish article</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Published articles are visible on the public Articles page.
                  </span>
                </span>
              </label>
            </div>

            <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  else router.push("/admin/articles");
                }}
                disabled={saving || uploading}
                className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving
                  ? "Saving..."
                  : savedArticleId
                    ? "Save changes"
                    : "Create article"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
