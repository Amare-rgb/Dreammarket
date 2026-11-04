"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  LoaderCircle,
  PackagePlus,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import axios from "axios";
import { api, uploadApi } from "@/lib/api";

interface ProductCategory {
  id: string;
  name: string;
  slug?: string;
  parentId?: string | null;
}

interface ProductCreateModalProps {
  categories: ProductCategory[];
  onClose: () => void;
  onCreated: () => void;
}

export default function ProductCreateModal({
  categories,
  onClose,
  onCreated,
}: ProductCreateModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availableCategories, setAvailableCategories] = useState(categories);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !submitting &&
        !uploading &&
        !creatingCategory
      ) {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, submitting, uploading, creatingCategory]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error("Choose image files only.");
          }
          if (file.size > 10 * 1024 * 1024) {
            throw new Error("Each image must be smaller than 10 MB.");
          }
          const response = await uploadApi.uploadProductImage(file);
          if (!response.success || !response.url) {
            throw new Error(response.message || "An image could not be uploaded.");
          }
          return response.url;
        })
      );
      setImages((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      const message = axios.isAxiosError(uploadError)
        ? uploadError.response?.data?.error ||
          uploadError.response?.data?.message ||
          "Could not upload the selected image(s)."
        : uploadError instanceof Error
          ? uploadError.message
          : "Could not upload the selected image(s).";
      setError(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setError("Enter a category name.");
      return;
    }

    if (
      availableCategories.some(
        (category) =>
          category.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      setError("A category with this name already exists.");
      return;
    }

    setError("");
    setCreatingCategory(true);
    try {
      const baseSlug =
        trimmedName
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "category";
      const usedSlugs = new Set(
        availableCategories.map(
          (category) =>
            category.slug ||
            category.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
        )
      );
      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const response = await api.post("/api/categories", {
        name: trimmedName,
        slug,
      });
      const createdCategory = response.data as ProductCategory;
      if (!createdCategory?.id || !createdCategory.name) {
        throw new Error(
          "The category was created but the server response was invalid."
        );
      }

      setAvailableCategories((current) => [...current, createdCategory]);
      setCategoryId(createdCategory.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (categoryError) {
      const message = axios.isAxiosError(categoryError)
        ? categoryError.response?.data?.error ||
          categoryError.response?.data?.message ||
          "Could not create the category."
        : categoryError instanceof Error
          ? categoryError.message
          : "Could not create the category.";
      setError(message);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/api/products", {
        name: name.trim(),
        description: description.trim(),
        categoryId,
        price: Number(price),
        pricePerUnit: Number(price),
        stock: Number(stock),
        images,
        unitOfMeasurement: "pcs",
        tags: [],
        durationTime: "1h",
      });
      onCreated();
    } catch (submitError) {
      const message = axios.isAxiosError(submitError)
        ? submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          "Could not create the product."
        : "Could not create the product.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting &&
          !uploading &&
          !creatingCategory
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-product-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EB6D3D]/15 text-[#cf5427]">
              <PackagePlus size={20} />
            </span>
            <div>
              <h2
                id="create-product-title"
                className="text-lg font-bold text-slate-900"
              >
                Add product
              </h2>
              <p className="text-xs text-slate-500">
                Enter the key details for this listing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || uploading || creatingCategory}
            aria-label="Close add product form"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto">
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Product name <span className="text-red-600">*</span>
              <input
                required
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter product name"
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
              Description <span className="text-red-600">*</span>
              <textarea
                required
                maxLength={10000}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe this product"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
              />
            </label>

            <div className="text-sm font-semibold text-slate-700 sm:col-span-2">
              <label htmlFor="product-category">
                Category <span className="text-red-600">*</span>
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <select
                  id="product-category"
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                >
                  <option value="">Select a category</option>
                  {availableCategories
                    .filter((category) => !category.parentId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setShowNewCategory((shown) => !shown);
                  }}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#EB6D3D] px-3 text-sm font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D]/10"
                >
                  <Plus size={16} />
                  Add category
                </button>
              </div>
              {showNewCategory && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row">
                  <input
                    autoFocus
                    maxLength={80}
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreateCategory();
                      }
                    }}
                    placeholder="New category name"
                    aria-label="New category name"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateCategory()}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#EB6D3D] px-3 text-sm font-semibold text-white transition hover:bg-[#cf5427] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingCategory && (
                      <LoaderCircle size={15} className="animate-spin" />
                    )}
                    {creatingCategory ? "Adding..." : "Save category"}
                  </button>
                </div>
              )}
            </div>

            <label className="text-sm font-semibold text-slate-700">
              Price (ETB) <span className="text-red-600">*</span>
              <div className="mt-1.5 flex h-11 items-center rounded-lg border border-slate-300 focus-within:border-[#EB6D3D] focus-within:ring-2 focus-within:ring-[#EB6D3D]/20">
                <span className="px-3 text-sm text-slate-500">ETB</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="0.00"
                  className="h-full min-w-0 flex-1 rounded-r-lg border-0 bg-transparent pr-3 font-normal outline-none"
                />
              </div>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Stock quantity <span className="text-red-600">*</span>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(event) => setStock(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
              />
            </label>

            <div className="sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Product images
              </span>
              <div className="mt-1.5 flex flex-wrap gap-3">
                {images.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200"
                  >
                    <Image
                      src={image}
                      alt={`Product image ${index + 1}`}
                      fill
                      unoptimized
                      sizes="80px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((current) =>
                          current.filter((_, imageIndex) => imageIndex !== index)
                        )
                      }
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow hover:bg-white"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-500 transition hover:border-[#EB6D3D] hover:text-[#cf5427] disabled:opacity-50"
                >
                  {uploading ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                  <span className="text-[11px]">
                    {uploading ? "Uploading" : "Upload"}
                  </span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={(event) => void handleImageUpload(event)}
                className="hidden"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Optional. JPG, PNG, WEBP, or GIF; up to 10 MB each.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2"
              >
                {error}
              </p>
            )}
          </div>

          <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || uploading || creatingCategory}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading || creatingCategory}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#EB6D3D] px-4 text-sm font-bold text-white transition hover:bg-[#cf5427] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <LoaderCircle size={16} className="animate-spin" />}
              {submitting ? "Creating..." : "Create product"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
