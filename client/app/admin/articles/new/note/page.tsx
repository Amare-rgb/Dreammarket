"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, UploadCloud, Check, Plus, LoaderCircle } from "lucide-react";
import { api, uploadApi } from "@/lib/api";
import {
  apiErrorText as errorText,
  useArticleCategories,
} from "@/lib/articleCategories";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]";

export default function NewArticleNotePage() {
  const router = useRouter();
  const { categories, loading: categoriesLoading, create: createCategory } = useArticleCategories();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState("");
  const [published, setPublished] = useState(false);

  // Status state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  // New category state
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const effectiveCategory = category || categories[0]?.slug || "";

  // Handle image upload
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be 10 MB or less.");
      return;
    }

    setError("");
    setUploading(true);
    try {
      const res = await uploadApi.uploadArticleImage(file);
      if (!res.success || !res.url) {
        throw new Error("Image upload did not return an image URL.");
      }
      setImage(res.url);
    } catch (e) {
      setError(errorText(e, "Failed to upload article image."));
    } finally {
      setUploading(false);
    }
  };

  // Handle new category creation
  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setError("");
    setCreatingCategory(true);
    try {
      const created = await createCategory(name);
      setCategory(created.slug);
      setNewCategoryName("");
      setNewCategoryOpen(false);
    } catch (e) {
      setError(errorText(e, "Could not create the category."));
    } finally {
      setCreatingCategory(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!effectiveCategory) return setError("Select a category.");
    if (!title.trim()) return setError("Enter the article title.");
    if (!description.trim()) return setError("Enter a short description.");
    if (!content.trim()) return setError("Enter the article content.");

    setSaving(true);
    try {
      await api.post("/api/articles/admin", {
        category: effectiveCategory,
        title: title.trim(),
        slug: "",
        description: description.trim(),
        content: content.trim(),
        note: note.trim(),
        image: image,
        videoUrl: "",
        published,
      });
      router.push("/admin/articles");
      router.refresh();
    } catch (err) {
      setError(errorText(err, "Failed to save the article note."));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      
      {/* Modal Card */}
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EB6D3D]/10 text-[#EB6D3D]">
              <Check size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Add article note</h2>
              <p className="text-sm text-slate-500">Enter the details for this article.</p>
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
                placeholder="Describe this article"
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Category <span className="text-[#EB6D3D]">*</span>
              </label>
              
              <div className="flex gap-2">
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
                
                {/* Add Category Button */}
                {!newCategoryOpen && (
                  <button
                    type="button"
                    onClick={() => setNewCategoryOpen(true)}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-[#EB6D3D] px-3 text-sm font-semibold text-[#EB6D3D] hover:bg-[#EB6D3D]/10"
                  >
                    <Plus size={16} /> Add category
                  </button>
                )}
              </div>

              {/* Inline New Category Form */}
              {newCategoryOpen && (
                <div className="mt-2 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreateCategory();
                      }
                    }}
                    placeholder="New category name"
                    autoFocus
                    className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#EB6D3D]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateCategory()}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="rounded bg-[#EB6D3D] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {creatingCategory ? "..." : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryOpen(false);
                      setNewCategoryName("");
                    }}
                    className="rounded bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

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

            {/* Additional Note */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Additional Note (Optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Any extra notes..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Image Upload (Like the screenshot) */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Article image (Optional)
              </label>
              
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImage}
                className="hidden"
              />

              {image ? (
                <div className="relative mt-2 inline-block">
                  <Image
                    src={image}
                    alt="Article cover"
                    width={120}
                    height={80}
                    unoptimized
                    className="h-20 w-32 rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImage("")}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-[#EB6D3D] hover:text-[#EB6D3D] transition"
                >
                  {uploading ? (
                    <LoaderCircle className="animate-spin" size={20} />
                  ) : (
                    <>
                      <UploadCloud size={20} />
                      <span className="text-xs font-semibold">Upload</span>
                    </>
                  )}
                </button>
              )}
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
              disabled={saving || uploading}
              className="rounded-lg bg-[#EB6D3D] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#cf5427] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save article"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}