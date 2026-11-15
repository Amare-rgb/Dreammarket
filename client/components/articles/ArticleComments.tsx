"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { LoaderCircle, MessageSquare, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/publicArticles";

interface ArticleComment {
  id: string | number;
  name: string;
  message: string;
  imageUrl?: string | null;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  user?: {
    name: string;
    avatar: string | null;
  } | null;
}

interface ArticleCommentsProps {
  slug: string;
}

export default function ArticleComments({ slug }: ArticleCommentsProps) {
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const commentFileRef = useRef<HTMLInputElement>(null);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
        setComments(res.data?.comments || []);
      } catch {
        setError("Comments could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(() => {
      void fetchComments();
    }, 0);
    return () => clearTimeout(timer);
  }, [slug]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSubmitError("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError("Image must be less than 10MB");
      return;
    }

    setUploadingImage(true);
    setSubmitError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post("/api/upload/feedback", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success) {
        setCommentImage(res.data.url);
        setCommentImagePreview(res.data.url);
      } else {
        setSubmitError(res.data?.error || "Failed to upload image");
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setSubmitError(error.response?.data?.error || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (commentFileRef.current) commentFileRef.current.value = "";
    }
  };

  const removeImage = () => {
    setCommentImage(null);
    setCommentImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentName.trim() || !commentMessage.trim()) {
      setSubmitError("Please enter your name and a comment.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitNotice("");
    try {
      const res = await api.post(
        `/api/articles/${encodeURIComponent(slug)}/comments`,
        { name: commentName.trim(), message: commentMessage.trim(), imageUrl: commentImage }
      );
      const created: ArticleComment | undefined = res.data?.comment;
      if (created) {
        setComments((prev) => [created, ...prev]);
        setSubmitNotice("Thank you! Your comment has been submitted for review.");
      } else {
        setSubmitNotice("Thank you! Your comment was submitted and will appear after review.");
      }
      setCommentMessage("");
      setCommentImage(null);
      setCommentImagePreview(null);
    } catch {
      setSubmitError("Your comment could not be sent. Please try again.");
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
      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        <MessageSquare size={20} className="text-[#EB6D3D]" />
        Comments ({comments.length})
      </h3>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        <div>
          <label htmlFor="comment-name" className="mb-1 block text-sm font-semibold text-slate-700">
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
          <label htmlFor="comment-message" className="mb-1 block text-sm font-semibold text-slate-700">
            Your comment
          </label>
          <textarea
            id="comment-message"
            value={commentMessage}
            onChange={(e) => setCommentMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/30"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {commentMessage.length}/1000
          </p>
        </div>

        {/* Image upload */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Attach image <span className="text-slate-400">(optional)</span>
          </label>
          {commentImagePreview ? (
            <div className="relative inline-block">
              <Image
                src={commentImagePreview}
                alt="Preview"
                width={150}
                height={100}
                className="rounded-lg object-cover border border-slate-300"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => commentFileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#EB6D3D] transition-colors"
            >
              {uploadingImage ? (
                <LoaderCircle className="h-6 w-6 animate-spin text-[#EB6D3D] mx-auto" />
              ) : (
                <>
                  <p className="text-sm text-slate-600">Click to upload image</p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</p>
                </>
              )}
            </div>
          )}
          <input
            ref={commentFileRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
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
          disabled={submitting || uploadingImage}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#cf5427] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <LoaderCircle size={16} className="animate-spin" />}
          {submitting ? "Posting..." : "Post comment"}
        </button>
      </form>

      {/* Comments List */}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
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
                <div className="flex items-center gap-2">
                  {c.user?.avatar ? (
                    <Image
                      src={c.user.avatar}
                      alt={c.name}
                      width={32}
                      height={32}
                      unoptimized={c.user.avatar.includes('googleusercontent.com')}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-xs font-medium text-slate-600">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <p className="text-sm font-bold text-slate-900">{c.name}</p>
                </div>
                <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {c.message}
              </p>
              {c.imageUrl && (
                <div className="mt-3">
                  <Image
                    src={c.imageUrl}
                    alt="Comment attachment"
                    width={300}
                    height={200}
                    className="rounded-lg object-cover border border-slate-200"
                  />
                </div>
              )}
              {c.reply && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-1">Admin Reply:</p>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">{c.reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
