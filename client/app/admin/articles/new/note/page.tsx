"use client";

import { ChangeEvent, FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X, UploadCloud, Check, Plus, LoaderCircle, FileText } from "lucide-react";
import { api, uploadApi } from "@/lib/api";
import { apiErrorText as errorText, useArticleCategories } from "@/lib/articleCategories";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]";
const smallInput =
  "w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#EB6D3D]";
const dashedBtn =
  "border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-[#EB6D3D] hover:text-[#EB6D3D]";

const emptyForm = {
  title: "", description: "", content: "", note: "",
  titleAm: "", descriptionAm: "", contentAm: "", noteAm: "",
};
type FormKey = keyof typeof emptyForm;

// Amharic translation fields
const amFields: { key: FormKey; label: string; placeholder: string; rows?: number; max?: number }[] = [
  { key: "titleAm", label: "የጽሑፉ ርዕስ", placeholder: "Enter Amharic title", max: 180 },
  { key: "descriptionAm", label: "ማጠቃለያ", placeholder: "Enter Amharic description", rows: 2, max: 1000 },
  { key: "contentAm", label: "የጽሑፉ ይዘት", placeholder: "Write the Amharic article content here...", rows: 4 },
  { key: "noteAm", label: "ተጨማሪ ማስታወሻ", placeholder: "Any extra notes in Amharic...", rows: 2 },
];

// Upload configs (image + pdf share one handler)
const uploadKinds = {
  image: {
    valid: (f: File) => f.type.startsWith("image/"),
    typeError: "Choose an image file.",
    maxMb: 10,
    sizeError: "Image size must be 10 MB or less.",
    upload: (f: File) => uploadApi.uploadArticleImage(f),
    noUrl: "Image upload did not return an image URL.",
    fail: "Failed to upload article image.",
  },
  pdf: {
    valid: (f: File) => f.type === "application/pdf",
    typeError: "Choose a PDF file.",
    maxMb: 20,
    sizeError: "PDF size must be 20 MB or less.",
    upload: (f: File) => uploadApi.uploadPdf(f),
    noUrl: "PDF upload did not return a file URL.",
    fail: "Failed to upload the PDF file.",
  },
};

function Field({ label, required, small, children }: { label: string; required?: boolean; small?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className={`mb-1 block font-semibold ${small ? "text-xs text-slate-600" : "text-sm text-slate-700"}`}>
        {label} {required && <span className="text-[#EB6D3D]">*</span>}
      </label>
      {children}
    </div>
  );
}

function RemoveBtn({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600 ${className}`}
    >
      <X size={12} />
    </button>
  );
}

export default function NewArticleNotePage() {
  const router = useRouter();
  const { categories, create: createCategory } = useArticleCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(emptyForm);
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [published, setPublished] = useState(false);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(true);

  const [newCat, setNewCat] = useState({ open: false, name: "", nameAm: "", parent: "" });
  const [creatingCategory, setCreatingCategory] = useState(false);

  const bind = (key: FormKey) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const effectiveCategory =
    category || categories.find((c) => !c.parentId)?.slug || categories[0]?.slug || "";

  // Top-level categories with their subcategories
  const categoryOptions = useMemo(() => {
    const childrenOf = new Map<string, typeof categories>();
    for (const c of categories) {
      if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) || []), c]);
    }
    return categories
      .filter((c) => !c.parentId)
      .map((c) => ({ ...c, children: childrenOf.get(c.id) || [] }));
  }, [categories]);

  const handleUpload =
    (kind: keyof typeof uploadKinds, setUrl: (url: string) => void) =>
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const cfg = uploadKinds[kind];

      if (!cfg.valid(file)) return setError(cfg.typeError);
      if (file.size > cfg.maxMb * 1024 * 1024) return setError(cfg.sizeError);

      setError("");
      setUploading(true);
      try {
        const res = await cfg.upload(file);
        if (!res.success || !res.url) throw new Error(cfg.noUrl);
        setUrl(res.url);
      } catch (e) {
        setError(errorText(e, cfg.fail));
      } finally {
        setUploading(false);
      }
    };

  const resetNewCat = () => setNewCat({ open: false, name: "", nameAm: "", parent: "" });

  const handleCreateCategory = async () => {
    const name = newCat.name.trim();
    if (!name) return;
    setError("");
    setCreatingCategory(true);
    try {
      const created = await createCategory(name, newCat.parent || null, newCat.nameAm.trim() || undefined);
      setCategory(created.slug);
      resetNewCat();
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
    if (!form.title.trim()) return setError("Enter the article title.");
    if (!form.description.trim()) return setError("Enter a short description.");
    if (!form.content.trim()) return setError("Enter the article content.");

    setSaving(true);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim()])
      );
      await api.post("/api/articles/admin", {
        category: effectiveCategory,
        ...trimmed,
        slug: "",
        image,
        videoUrl: "",
        pdfUrl,
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

  const onEnterCreate = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreateCategory();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EB6D3D]/10 text-[#EB6D3D]">
              <Check size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add article note</h2>
              <p className="text-xs text-slate-500">Enter the details for this article.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            <Field label="Article title" required>
              <input {...bind("title")} maxLength={180} placeholder="Enter article title" className={inputClass} />
            </Field>

            <Field label="Description" required>
              <textarea
                {...bind("description")}
                maxLength={1000}
                rows={2}
                placeholder="Describe this article"
                className={`${inputClass} resize-none`}
              />
            </Field>

            {/* Category */}
            <Field label="Category" required>
              <div className="flex gap-2">
                <select
                  value={effectiveCategory}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>Select a category</option>
                  {categoryOptions.map((c) =>
                    c.children.length > 0 ? (
                      <optgroup key={c.id} label={c.name}>
                        <option value={c.slug}>{c.name}</option>
                        {c.children.map((sub) => (
                          <option key={sub.id} value={sub.slug}>
                            {"\u00A0\u00A0\u00A0\u00A0"}{sub.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    )
                  )}
                </select>

                {!newCat.open && (
                  <button
                    type="button"
                    onClick={() => setNewCat((n) => ({ ...n, open: true }))}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-[#EB6D3D] px-3 text-sm font-semibold text-[#EB6D3D] hover:bg-[#EB6D3D]/10"
                  >
                    <Plus size={16} /> Add
                  </button>
                )}
              </div>

              {newCat.open && (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Field label="Create as" small>
                    <select
                      value={newCat.parent}
                      onChange={(e) => setNewCat((n) => ({ ...n, parent: e.target.value }))}
                      className={smallInput}
                    >
                      <option value="">Top-level category</option>
                      {categories.filter((c) => !c.parentId).map((c) => (
                        <option key={c.id} value={c.id}>Subcategory of: {c.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={newCat.parent ? "Subcategory name" : "Category name"} small>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <input
                        value={newCat.name}
                        onChange={(e) => setNewCat((n) => ({ ...n, name: e.target.value }))}
                        onKeyDown={onEnterCreate}
                        placeholder={newCat.parent ? "e.g. Tips & Tricks" : "e.g. General"}
                        autoFocus
                        className={smallInput}
                      />
                      <input
                        value={newCat.nameAm}
                        onChange={(e) => setNewCat((n) => ({ ...n, nameAm: e.target.value }))}
                        onKeyDown={onEnterCreate}
                        placeholder="ስም በአማርኛ (optional)"
                        dir="rtl"
                        className={smallInput}
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateCategory()}
                        disabled={creatingCategory || !newCat.name.trim()}
                        className="rounded bg-[#EB6D3D] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {creatingCategory ? "..." : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={resetNewCat}
                        className="rounded bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </Field>
                </div>
              )}
            </Field>

            <Field label="Article content" required>
              <textarea
                {...bind("content")}
                rows={4}
                placeholder="Write the full article content here..."
                className={`${inputClass} resize-none`}
              />
            </Field>

            <Field label="Additional Note (Optional)">
              <textarea
                {...bind("note")}
                rows={2}
                placeholder="Any extra notes..."
                className={`${inputClass} resize-none`}
              />
            </Field>

            {/* Amharic translation (optional) */}
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-700">
                አማርኛ ትርጉም <span className="font-normal text-slate-400">(optional)</span>
              </p>
              {amFields.map(({ key, label, placeholder, rows, max }) => (
                <Field key={key} label={label} small>
                  {rows ? (
                    <textarea
                      {...bind(key)}
                      maxLength={max}
                      rows={rows}
                      placeholder={placeholder}
                      className={`${inputClass} resize-none`}
                    />
                  ) : (
                    <input {...bind(key)} maxLength={max} placeholder={placeholder} className={inputClass} />
                  )}
                </Field>
              ))}
            </div>

            {/* Image + PDF uploads */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleUpload("image", setImage)}
              className="hidden"
            />
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              onChange={handleUpload("pdf", setPdfUrl)}
              className="hidden"
            />

            <Field label="Article image (Optional)">
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
                  <RemoveBtn onClick={() => setImage("")} className="absolute -right-2 -top-2" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className={`mt-2 flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg ${dashedBtn}`}
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
            </Field>

            <Field label="Article PDF (Optional)">
              {pdfUrl ? (
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <FileText size={20} className="shrink-0 text-[#EB6D3D]" />
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-sm font-semibold text-[#cf5427] hover:underline"
                  >
                    {pdfUrl.split("/").pop()}
                  </a>
                  <RemoveBtn onClick={() => setPdfUrl("")} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pdfRef.current?.click()}
                  disabled={uploading}
                  className={`mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-60 ${dashedBtn}`}
                >
                  {uploading ? (
                    <LoaderCircle className="animate-spin" size={18} />
                  ) : (
                    <>
                      <FileText size={18} />
                      <span>Upload PDF</span>
                    </>
                  )}
                </button>
              )}
            </Field>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-[#EB6D3D]"
              />
              <span className="font-semibold">Publish this article immediately</span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white p-3">
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