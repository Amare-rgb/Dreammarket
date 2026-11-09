"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Video } from "lucide-react";
import { api } from "@/lib/api";
import { getVideoSource, isValidHttpUrl } from "@/lib/video";
import {
  apiErrorText as errorText,
  useArticleCategories,
} from "@/lib/articleCategories";
import VideoPlayer from "@/components/VideoPlayer";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]";

export default function NewArticleVideoPage() {
  const router = useRouter();
  const { categories, loading: categoriesLoading } = useArticleCategories();

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [published, setPublished] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const effectiveCategory = category || categories[0]?.slug || "";
  const videoSource = videoUrl.trim() ? getVideoSource(videoUrl) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!effectiveCategory) return setError("Choose a category first.");
    if (!title.trim()) return setError("Enter the article title.");
    if (!description.trim()) return setError("Enter a short description.");
    if (!content.trim()) return setError("Enter the article content.");

    const url = videoUrl.trim();
    if (!url) return setError("A video URL is required for this form.");
    if (!isValidHttpUrl(url)) {
      return setError("Video URL must start with http:// or https://.");
    }

    setSaving(true);
    try {
      await api.post("/api/articles/admin", {
        category: effectiveCategory,
        title: title.trim(),
        slug: "",
        description: description.trim(),
        content: content.trim(),
        note: "",
        image: "",
        videoUrl: url,
        published,
      });
      router.push("/admin/articles");
      router.refresh();
    } catch (err) {
      setError(errorText(err, "Failed to save the article video."));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    router.push("/admin/articles");
  };

  if (!isOpen) return null;

  return (
    /* Dark backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      
      {/* Modal Card */}
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EB6D3D]/10 text-[#EB6D3D]">
              <Video size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Add article video</h2>
              <p className="text-sm text-slate-500">Attach a YouTube or Vimeo link.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Article title <span className="text-[#EB6D3D]">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={180}
                placeholder="Enter article title"
                className={inputClass}
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Description <span className="text-[#EB6D3D]">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Short description for the card..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Category <span className="text-[#EB6D3D]">*</span>
              </label>
              <select
                value={effectiveCategory}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Video URL */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Video URL <span className="text-[#EB6D3D]">*</span>
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                maxLength={500}
                placeholder="https://www.youtube.com/watch?v=..."
                className={inputClass}
              />
              {videoUrl.trim() && !videoSource && (
                <p className="mt-1 text-xs text-red-600">
                  Not a valid video link yet.
                </p>
              )}
            </div>

            {/* Video Preview */}
            {videoSource && (
              <div className="max-w-2xl overflow-hidden rounded-lg border border-slate-200">
                <VideoPlayer url={videoUrl} title={title || "Video preview"} />
              </div>
            )}

            {/* Content */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Article content <span className="text-[#EB6D3D]">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Write the full article content here..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Publish Toggle */}
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#EB6D3D]"
              />
              <span className="font-semibold">Publish this article immediately</span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="border-t border-slate-100 bg-white p-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#EB6D3D] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#cf5427] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}