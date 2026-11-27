"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, MessageSquare, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/publicArticles";
import { useLanguage } from "@/context/LanguageContext";

interface ArticleComment {
  id: string | number;
  name: string;
  message: string;
  imageUrl?: string | null;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  user?: { name: string; avatar: string | null } | null;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FIELD_CLS =
  "w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/30";

export default function ArticleComments({ slug }: { slug: string }) {
  const { t } = useLanguage();
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loadedSlug, setLoadedSlug] = useState("");
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loading = loadedSlug !== slug && !loadError;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
        if (!active) return;
        setComments(res.data?.comments || []);
        setLoadError("");
        setLoadedSlug(slug);
      } catch {
        if (!active) return;
        setLoadError(t("articles.comments_load_failed", "Comments could not be loaded."));
        setLoadedSlug(slug);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, t]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return setSubmitError(t("articles.upload_image_error", "Please upload an image file"));
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return setSubmitError(t("articles.upload_image_size", "Image must be less than 10MB"));
    }

    setUploading(true);
    setSubmitError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/api/upload/feedback", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success && res.data.url) {
        setImageUrl(res.data.url);
      } else {
        setSubmitError(res.data?.error || t("articles.upload_failed", "Failed to upload image"));
      }
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSubmitError(msg || t("articles.upload_failed", "Failed to upload image"));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      return setSubmitError(t("articles.comment_required", "Please enter your name and a comment."));
    }

    setSubmitting(true);
    setSubmitError("");
    setNotice("");
    try {
      const res = await api.post(`/api/articles/${encodeURIComponent(slug)}/comments`, {
        name: name.trim(),
        message: message.trim(),
        imageUrl,
      });
      if (res.data?.comment) {
        setComments((prev) => [res.data.comment, ...prev]);
        setNotice(t("articles.comment_sent_review", "Thank you! Your comment has been submitted for review."));
      } else {
        setNotice(t("articles.comment_sent_pending", "Thank you! Your comment was submitted and will appear after review."));
      }
      setMessage("");
      setImageUrl(null);
    } catch {
      setSubmitError(t("articles.comment_failed", "Your comment could not be sent. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-20 items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#F47822]" />
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-slate-100 pt-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
        <MessageSquare size={20} className="text-[#EB6D3D]" />
        {t("articles.comments", "Comments")} ({comments.length})
      </h3>

      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label htmlFor="comment-name" className="mb-1 block text-sm font-semibold text-slate-700">
            {t("articles.your_name", "Your name")}
          </label>
          <input
            id="comment-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            className={`${FIELD_CLS} h-11`}
          />
        </div>

        <div>
          <label htmlFor="comment-message" className="mb-1 block text-sm font-semibold text-slate-700">
            {t("articles.your_comment", "Your comment")}
          </label>
          <textarea
            id="comment-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            className={`${FIELD_CLS} resize-y py-2 leading-6`}
          />
          <p className="mt-1 text-right text-xs text-slate-400">{message.length}/1000</p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            {t("articles.attach_image", "Attach image")}{" "}
            <span className="text-slate-400">{t("articles.optional", "(optional)")}</span>
          </span>
          {imageUrl ? (
            <div className="relative inline-block">
              <Image
                src={imageUrl}
                alt="Preview"
                width={150}
                height={100}
                unoptimized
                className="rounded-lg border border-slate-300 object-cover"
              />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                aria-label="Remove image"
                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-4 text-center transition-colors hover:border-[#EB6D3D] disabled:opacity-60"
            >
              {uploading ? (
                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[#EB6D3D]" />
              ) : (
                <>
                  <p className="text-sm text-slate-600">{t("articles.click_upload", "Click to upload image")}</p>
                  <p className="mt-1 text-xs text-slate-400">{t("articles.upload_hint", "PNG, JPG up to 10MB")}</p>
                </>
              )}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
        {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

        <button
          type="submit"
          disabled={submitting || uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#cf5427] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <LoaderCircle size={16} className="animate-spin" />}
          {submitting ? t("articles.posting", "Posting...") : t("articles.post_comment", "Post comment")}
        </button>
      </form>

      {loadError ? (
        <p role="alert" className="text-sm text-red-700">{loadError}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">{t("articles.no_comments", "No comments yet. Be the first to comment.")}</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {c.user?.avatar ? (
                    <Image
                      src={c.user.avatar}
                      alt={c.name}
                      width={32}
                      height={32}
                      unoptimized
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                      <span className="text-xs font-medium text-slate-600">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <p className="text-sm font-bold text-slate-900">{c.name}</p>
                </div>
                <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{c.message}</p>
              {c.imageUrl && (
                <div className="mt-3">
                  <Image
                    src={c.imageUrl}
                    alt="Comment attachment"
                    width={300}
                    height={200}
                    unoptimized
                    className="rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              )}
              {c.reply && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-blue-900">{t("articles.admin_reply", "Admin Reply:")}</p>
                  <p className="whitespace-pre-wrap text-sm text-blue-800">{c.reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}