"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Gift,
  LoaderCircle,
  PackagePlus,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
  Check,
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
  onCategoryDeleted?: () => void;
  onCategoryAdded?: () => void; // ✅ Added prop
}

interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

interface PriceRow {
  id: number;
  currency: string;
  amount: string;
  discountAmount: string;
}

const CURRENCIES: CurrencyOption[] = [
  { code: "ETB", label: "Ethiopian Birr", symbol: "Br" },
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" },
  { code: "SAR", label: "Saudi Riyal", symbol: "﷼" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
  { code: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { code: "CAD", label: "Canadian Dollar", symbol: "$" },
  { code: "AUD", label: "Australian Dollar", symbol: "$" },
];

const DEFAULT_CURRENCY = "ETB";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const formatMoney = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const getVideoEmbedUrl = (url: string) => {
  if (!url) return null;
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:.*#|.*\/videos\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
};

export default function ProductCreateModal({
  categories,
  onClose,
  onCreated,
  onCategoryDeleted,
  onCategoryAdded, // ✅ Destructured
}: ProductCreateModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const priceRowId = useRef(1);
  
  const [createdCategories, setCreatedCategories] = useState<ProductCategory[]>([]);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([
    { id: 1, currency: DEFAULT_CURRENCY, amount: "", discountAmount: "" },
  ]);
  const [stock, setStock] = useState("0");
  const [availabilityStatus, setAvailabilityStatus] = useState<"AVAILABLE" | "OUT_OF_STOCK_TEMPORARY">("AVAILABLE");
  const [autoRestock, setAutoRestock] = useState(true);
  const [restockAfterDays, setRestockAfterDays] = useState("2");
  const [restockQuantity, setRestockQuantity] = useState("10");
  const [availableAt, setAvailableAt] = useState("");
  const [restockDate, setRestockDate] = useState("");
  const [saleEndDate, setSaleEndDate] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [videoUrl, setVideoUrl] = useState("");
  const [videoInputValue, setVideoInputValue] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoInputMode, setVideoInputMode] = useState<"upload" | "url">("upload");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Side / add-on products & size variants ──
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [sideProducts, setSideProducts] = useState<{ productId: string; bundlePrice: string }[]>([]);
  const [sizeVariants, setSizeVariants] = useState<{ size: string; stock: string; sku: string }[]>([]);

  // ── Quick product purchase reward (optional) ──
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardTriggerType, setRewardTriggerType] = useState<"MIN_QUANTITY" | "MIN_SPEND">("MIN_QUANTITY");
  const [rewardThreshold, setRewardThreshold] = useState("");
  const [rewardType, setRewardType] = useState<"FIXED_CASHBACK" | "PERCENT_DISCOUNT" | "FREE_ITEM" | "CUSTOM" | "MOBILE_AIRTIME">("FIXED_CASHBACK");
  const [rewardValue, setRewardValue] = useState("");
  const [rewardPromoCode, setRewardPromoCode] = useState("");
  const [rewardExpiresAt, setRewardExpiresAt] = useState("");

  useEffect(() => {
    api
      .get("/api/products")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.products || [];
        setAllProducts(
          (Array.isArray(list) ? list : [])
            .map((p: { id?: unknown; name?: unknown }) => ({
              id: String(p.id ?? ""),
              name: String(p.name ?? ""),
            }))
            .filter((p) => p.id && p.name)
        );
      })
      .catch(() => {});
  }, []);

  const busy = submitting || uploading || uploadingVideo || creatingCategory || deletingCategory;
  const usedCurrencies = priceRows.map((row) => row.currency);
  const canAddCurrency = usedCurrencies.length < CURRENCIES.length;

  const availableCategories = [
    ...categories,
    ...createdCategories.filter(
      (c) => !categories.some((parentCat) => parentCat.id === c.id)
    ),
  ];

  const embedUrl = getVideoEmbedUrl(videoUrl);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
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
  }, [onClose, busy]);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      return (
        err.response?.data?.error || err.response?.data?.message || fallback
      );
    }
    return err instanceof Error ? err.message : fallback;
  };

  const addPriceRow = () => {
    const nextCurrency = CURRENCIES.find(
      (item) => !usedCurrencies.includes(item.code)
    );
    if (!nextCurrency) return;
    priceRowId.current += 1;
    setPriceRows((rows) => [
      ...rows,
      { id: priceRowId.current, currency: nextCurrency.code, amount: "", discountAmount: "" },
    ]);
  };

  const updatePriceRow = (id: number, changes: Partial<PriceRow>) => {
    setPriceRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...changes } : row))
    );
  };

  const removePriceRow = (id: number) => {
    setPriceRows((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== id) : rows
    );
  };

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
          if (file.size > MAX_IMAGE_SIZE) {
            throw new Error("Each image must be smaller than 10 MB.");
          }
          const response = await uploadApi.uploadProductImage(file);
          if (!response.success || !response.url) {
            throw new Error(
              response.message || "An image could not be uploaded."
            );
          }
          return response.url;
        })
      );
      setImages((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(
        getErrorMessage(uploadError, "Could not upload the selected image(s).")
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleVideoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setUploadingVideo(true);
    try {
      if (!file.type.startsWith("video/")) {
        throw new Error("Choose a video file only (MP4, WEBM, or MOV).");
      }
      if (file.size > MAX_VIDEO_SIZE) {
        throw new Error("The video must be smaller than 100 MB.");
      }
      const response = await uploadApi.uploadProductVideo(file);
      if (!response.success || !response.url) {
        throw new Error(response.message || "The video could not be uploaded.");
      }
      setVideoUrl(response.url);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Could not upload the video."));
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const handleSaveVideoUrl = () => {
    const trimmed = videoInputValue.trim();
    if (trimmed) {
      setVideoUrl(trimmed);
    }
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setError("Enter a category name.");
      return;
    }

    const normalizedName = trimmedName.replace(/\s+/g, " ").trim();

    if (
      availableCategories.some(
        (category) =>
          category.name.trim().toLowerCase() === normalizedName.toLowerCase()
      )
    ) {
      setError("A category with this name already exists.");
      return;
    }

    setError("");
    setCreatingCategory(true);
    try {
      const baseSlug =
        normalizedName
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "category";

      const usedSlugs = new Set(
        availableCategories.map((category) => {
          const generated =
            category.slug ||
            (category.name || "")
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
          return generated || "category";
        })
      );

      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }

      const response = await api.post("/api/categories", {
        name: normalizedName,
        slug,
      });

      const createdCategory =
        (response.data?.category as ProductCategory) ||
        (response.data as ProductCategory);

      if (!createdCategory?.id || !createdCategory.name) {
        throw new Error(
          "The category was created but the server response was invalid."
        );
      }

      setCreatedCategories((current) => [...current, createdCategory]);
      setCategoryId(createdCategory.id);
      setNewCategoryName("");
      setShowNewCategory(false);
      setError("");

      // ✅ Notify the parent to refresh
      if (onCategoryAdded) {
        onCategoryAdded();
      }
    } catch (categoryError) {
      setError(getErrorMessage(categoryError, "Could not create the category."));
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryId) return;
    const categoryToDelete = availableCategories.find((c) => c.id === categoryId);
    if (!categoryToDelete) return;

    if (!confirm(`Are you sure you want to delete the category "${categoryToDelete.name}"?`)) {
      return;
    }

    setError("");
    setDeletingCategory(true);
    try {
      await api.delete(`/api/categories/${categoryId}`);
      
      setCreatedCategories((current) => current.filter((c) => c.id !== categoryId));
      setCategoryId(""); 
      
      if (onCategoryDeleted) {
        onCategoryDeleted();
      }
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete the category."));
    } finally {
      setDeletingCategory(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const prices = priceRows.map((row) => ({
      currency: row.currency,
      amount: Number(row.amount),
    }));

    if (prices.some((p) => !Number.isFinite(p.amount) || p.amount <= 0)) {
      setError("Enter a valid price greater than 0 for every currency.");
      return;
    }

    const primary = prices[0];

    // Build per-currency discount prices (direct amounts)
    const discountPrices: { currency: string; amount: number }[] = [];
    for (const row of priceRows) {
      if (row.discountAmount.trim() !== "") {
        const dAmount = Number(row.discountAmount);
        const original = Number(row.amount);
        if (!Number.isFinite(dAmount) || dAmount <= 0 || dAmount >= original) {
          setError(
            `Discount for ${row.currency} must be greater than 0 and less than its price (${original}).`
          );
          return;
        }
        discountPrices.push({ currency: row.currency, amount: dAmount });
      }
    }

    setSubmitting(true);
    try {
      const response = await api.post("/api/products", {
        name: name.trim(),
        description: description.trim(),
        categoryId,
        price: primary.amount,
        pricePerUnit: primary.amount,
        currency: primary.currency,
        prices,
        discountPrices,
        stock: Number(stock),
        availabilityStatus,
        autoRestock,
        restockAfterDays: Number(restockAfterDays) || 2,
        restockQuantity: Number(restockQuantity) || 10,
        availableAt: availableAt || undefined,
        restockDate: restockDate || undefined,
        saleEndDate: saleEndDate || undefined,
        images,
        videoUrl: videoUrl || undefined,
        sideProducts: sideProducts
          .filter((s) => s.productId)
          .map((s) => ({
            productId: s.productId,
            bundlePrice: s.bundlePrice.trim() === "" ? null : Number(s.bundlePrice),
          })),
        sizeVariants: sizeVariants
          .filter((s) => s.size.trim() !== "")
          .map((s) => ({
            size: s.size.trim(),
            stock: Number(s.stock) || 0,
            sku: s.sku.trim() || undefined,
          })),
        unitOfMeasurement: "pcs",
        tags: [],
        durationTime: "1h",
      });

      // ── Create product-scoped reward rule if enabled ──
      const newProductId = response?.data?.product?.id;
      const thresholdNum = Number(rewardThreshold);
      if (
        rewardEnabled &&
        newProductId &&
        Number.isFinite(thresholdNum) &&
        thresholdNum > 0 &&
        rewardValue.trim()
      ) {
        try {
          await api.post("/api/admin/rewards/rules", {
            name: `${name.trim()} — purchase reward`,
            scope: "PRODUCT",
            productId: newProductId,
            triggerType: rewardTriggerType,
            threshold: thresholdNum,
            minSpend: rewardTriggerType === "MIN_SPEND" ? thresholdNum : null,
            rewardType,
            rewardValue: rewardValue.trim(),
            currency: primary.currency,
            promoCode: rewardPromoCode.trim() || null,
            expiresAt: rewardExpiresAt || null,
            active: true,
          });
        } catch (rewardErr) {
          console.warn("Product created but reward rule failed:", rewardErr);
        }
      }

      onCreated();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Could not create the product."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
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
            disabled={busy}
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
                  {availableCategories.map((category) => {
                    const parentName = category.parentId
                      ? availableCategories.find(
                          (c) => c.id === category.parentId
                        )?.name
                      : null;
                    return (
                      <option key={category.id} value={category.id}>
                        {parentName ? `${parentName} / ${category.name}` : category.name}
                      </option>
                    );
                  })}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setShowNewCategory((shown) => !shown);
                    }}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#EB6D3D] px-3 text-sm font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D]/10"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCategory()}
                    disabled={!categoryId || deletingCategory}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingCategory ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
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

            <div className="text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>
                Prices <span className="text-red-600">*</span>
              </span>
              <div className="mt-1.5 space-y-2">
                {priceRows.map((row, index) => {
                  const amount = Number(row.amount);
                  const valid = Number.isFinite(amount) && amount > 0;
                  const rowCurrencies = CURRENCIES.filter(
                    (item) =>
                      item.code === row.currency ||
                      !usedCurrencies.includes(item.code)
                  );
                  return (
                    <div key={row.id}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-11 flex-1 items-stretch rounded-lg border border-slate-300 focus-within:border-[#EB6D3D] focus-within:ring-2 focus-within:ring-[#EB6D3D]/20">
                          <select
                            aria-label={`Currency ${index + 1}`}
                            value={row.currency}
                            onChange={(event) =>
                              updatePriceRow(row.id, {
                                currency: event.target.value,
                              })
                            }
                            className="h-full w-32 shrink-0 rounded-l-lg border-0 border-r border-slate-300 bg-slate-50 px-2 text-sm font-semibold text-slate-700 outline-none"
                          >
                            {rowCurrencies.map((item) => (
                              <option key={item.code} value={item.code}>
                                {item.code} ({item.symbol})
                              </option>
                            ))}
                          </select>
                          <input
                            required
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) =>
                              updatePriceRow(row.id, {
                                amount: event.target.value,
                              })
                            }
                            placeholder="0.00"
                            aria-label={`Price amount ${index + 1}`}
                            className="h-full min-w-0 flex-1 rounded-r-lg border-0 bg-transparent px-3 font-normal outline-none"
                          />
                        </div>
                        <div className="flex h-11 flex-1 items-stretch rounded-lg border border-slate-300 focus-within:border-[#EB6D3D] focus-within:ring-2 focus-within:ring-[#EB6D3D]/20">
                          <span className="flex h-full items-center border-0 border-r border-slate-300 bg-slate-50 px-2 text-xs font-semibold text-slate-500">
                            Disc
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.discountAmount}
                            onChange={(event) =>
                              updatePriceRow(row.id, {
                                discountAmount: event.target.value,
                              })
                            }
                            placeholder="0.00"
                            aria-label={`Discount amount ${index + 1}`}
                            className="h-full min-w-0 flex-1 rounded-r-lg border-0 bg-transparent px-3 font-normal outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePriceRow(row.id)}
                          disabled={priceRows.length === 1}
                          aria-label={`Remove price ${index + 1}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        {index === 0 ? "Main price" : "Additional price"}
                        {valid ? `: ${formatMoney(amount, row.currency)}` : ""}
                        {row.discountAmount.trim() !== "" && Number(row.discountAmount) > 0 && Number(row.discountAmount) < amount
                          ? ` · Disc: ${formatMoney(Number(row.discountAmount), row.currency)} · Save: ${formatMoney(amount - Number(row.discountAmount), row.currency)}`
                          : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addPriceRow}
                disabled={!canAddCurrency}
                className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#EB6D3D] px-3 text-sm font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} />
                Add another currency
              </button>
            </div>

            <p className="text-xs font-normal text-slate-500 sm:col-span-2">
              <strong>Price</strong> = original price (e.g., 688). <strong>Disc</strong> = discount price customers pay (e.g., 89). Customer sees: 89 (was 688, save 599). Leave Disc empty for no discount.
            </p>

            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
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

            {/* Availability status */}
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-sm font-semibold text-slate-700">
                Availability status
              </span>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAvailabilityStatus("AVAILABLE")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    availabilityStatus === "AVAILABLE"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${availabilityStatus === "AVAILABLE" ? "bg-emerald-500" : "bg-slate-300"}`} />
                  Available now
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityStatus("OUT_OF_STOCK_TEMPORARY")}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    availabilityStatus === "OUT_OF_STOCK_TEMPORARY"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${availabilityStatus === "OUT_OF_STOCK_TEMPORARY" ? "bg-amber-500" : "bg-slate-300"}`} />
                  Out of stock temporarily
                </button>
              </div>

              {availabilityStatus === "OUT_OF_STOCK_TEMPORARY" && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoRestock}
                      onChange={(e) => setAutoRestock(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#EB6D3D] focus:ring-[#EB6D3D]"
                    />
                    Auto-restock after a set number of days
                  </label>
                  {autoRestock && (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs font-medium text-slate-600">
                        Restock after (days)
                        <input
                          type="number"
                          min="1"
                          value={restockAfterDays}
                          onChange={(e) => setRestockAfterDays(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal outline-none focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-600">
                        Restock quantity
                        <input
                          type="number"
                          min="1"
                          value={restockQuantity}
                          onChange={(e) => setRestockQuantity(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal outline-none focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">
                Stock &amp; countdown dates{" "}
                <span className="font-normal text-slate-400">
                  (optional — powers live countdowns on the shop)
                </span>
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-600">
                  Available / arrival date
                  <input
                    type="datetime-local"
                    value={availableAt}
                    onChange={(e) => setAvailableAt(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal outline-none focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Restock date
                  <input
                    type="datetime-local"
                    value={restockDate}
                    onChange={(e) => setRestockDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal outline-none focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]"
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Sale / offer ends
                  <input
                    type="datetime-local"
                    value={saleEndDate}
                    onChange={(e) => setSaleEndDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal outline-none focus:border-[#EB6D3D] focus:ring-1 focus:ring-[#EB6D3D]"
                  />
                </label>
              </div>
            </div>

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

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Product video
                </span>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setVideoInputMode("upload")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      videoInputMode === "upload"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoInputMode("url")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      videoInputMode === "url"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    URL
                  </button>
                </div>
              </div>

              <div className="mt-1.5">
                {videoUrl ? (
                  <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black">
                    {embedUrl ? (
                      <iframe
                        src={embedUrl}
                        className="max-h-56 w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={videoUrl}
                        controls
                        preload="metadata"
                        className="max-h-56 w-full"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setVideoUrl("");
                        setVideoInputValue("");
                      }}
                      aria-label="Remove video"
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-600 shadow hover:bg-white z-10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : videoInputMode === "url" ? (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://youtube.com/shorts/... or MP4 link"
                      value={videoInputValue}
                      onChange={(e) => setVideoInputValue(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none transition focus:border-[#EB6D3D] focus:ring-2 focus:ring-[#EB6D3D]/20"
                    />
                    <button
                      type="button"
                      onClick={handleSaveVideoUrl}
                      disabled={!videoInputValue.trim()}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#EB6D3D] text-white transition hover:bg-[#cf5427] disabled:opacity-50"
                      aria-label="Save URL"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploadingVideo}
                    className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-slate-500 transition hover:border-[#EB6D3D] hover:text-[#cf5427] disabled:opacity-50"
                  >
                    {uploadingVideo ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <Video size={20} />
                    )}
                    <span className="text-xs">
                      {uploadingVideo ? "Uploading video..." : "Upload video"}
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(event) => void handleVideoUpload(event)}
                className="hidden"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {videoInputMode === "upload"
                  ? "Optional. MP4, WEBM, or MOV; up to 100 MB."
                  : "Optional. Paste a direct MP4 link or a YouTube/Vimeo link."}
              </p>
            </div>

            {/* ── Side / add-on products ── */}
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Side / add-on products{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSideProducts((rows) => [...rows, { productId: "", bundlePrice: "" }])}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EB6D3D] px-2.5 text-xs font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D]/10"
                >
                  <Plus size={14} /> Add side product
                </button>
              </div>
              {sideProducts.length > 0 && (
                <div className="mt-3 space-y-2">
                  {sideProducts.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={row.productId}
                        onChange={(e) =>
                          setSideProducts((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, productId: e.target.value } : r))
                          )
                        }
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[#EB6D3D]"
                      >
                        <option value="">Select product…</option>
                        {allProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.bundlePrice}
                        onChange={(e) =>
                          setSideProducts((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, bundlePrice: e.target.value } : r))
                          )
                        }
                        placeholder="Bundle price"
                        className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[#EB6D3D]"
                      />
                      <button
                        type="button"
                        onClick={() => setSideProducts((rows) => rows.filter((_, i) => i !== index))}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        aria-label="Remove side product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Size variants with per-size stock ── */}
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Size variants &amp; stock{" "}
                  <span className="font-normal text-slate-400">(optional — e.g. S, M, L or 38, 40)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSizeVariants((rows) => [...rows, { size: "", stock: "0", sku: "" }])}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EB6D3D] px-2.5 text-xs font-semibold text-[#cf5427] transition hover:bg-[#EB6D3D]/10"
                >
                  <Plus size={14} /> Add size
                </button>
              </div>
              {sizeVariants.length > 0 && (
                <div className="mt-3 space-y-2">
                  {sizeVariants.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={row.size}
                        onChange={(e) =>
                          setSizeVariants((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, size: e.target.value } : r))
                          )
                        }
                        placeholder="Size (e.g. M)"
                        className="h-10 w-28 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[#EB6D3D]"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.stock}
                        onChange={(e) =>
                          setSizeVariants((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, stock: e.target.value } : r))
                          )
                        }
                        placeholder="Stock"
                        className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[#EB6D3D]"
                      />
                      <input
                        value={row.sku}
                        onChange={(e) =>
                          setSizeVariants((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, sku: e.target.value } : r))
                          )
                        }
                        placeholder="SKU (optional)"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[#EB6D3D]"
                      />
                      <button
                        type="button"
                        onClick={() => setSizeVariants((rows) => rows.filter((_, i) => i !== index))}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                        aria-label="Remove size"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Product Purchase Reward (optional) ── */}
            <div className="rounded-xl border border-[#EB6D3D]/30 bg-[#EB6D3D]/5 p-4 sm:col-span-2">
              <button
                type="button"
                onClick={() => setRewardEnabled((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Gift size={16} className="text-[#cf5427]" />
                  Product Purchase Reward (Optional)
                </span>
                <span className="text-xs font-semibold text-[#cf5427]">
                  {rewardEnabled ? "Hide" : "Configure"}
                </span>
              </button>
              {rewardEnabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Trigger
                    <select
                      value={rewardTriggerType}
                      onChange={(e) => setRewardTriggerType(e.target.value as typeof rewardTriggerType)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="MIN_QUANTITY">Buy ≥ quantity</option>
                      <option value="MIN_SPEND">Spend ≥ ETB</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    {rewardTriggerType === "MIN_QUANTITY" ? "Min. quantity" : "Min. spend (ETB)"}
                    <input
                      type="number"
                      min="0"
                      step={rewardTriggerType === "MIN_QUANTITY" ? "1" : "0.01"}
                      value={rewardThreshold}
                      onChange={(e) => setRewardThreshold(e.target.value)}
                      placeholder={rewardTriggerType === "MIN_QUANTITY" ? "2" : "5000"}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Reward type
                    <select
                      value={rewardType}
                      onChange={(e) => setRewardType(e.target.value as typeof rewardType)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="FIXED_CASHBACK">Fixed Cashback (ETB)</option>
                      <option value="PERCENT_DISCOUNT">Percentage Discount (%)</option>
                      <option value="FREE_ITEM">Free Bonus Item</option>
                      <option value="MOBILE_AIRTIME">Mobile Airtime (ETB)</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    {rewardType === "PERCENT_DISCOUNT" ? "Percent (%)" : rewardType === "FREE_ITEM" ? "Gift name" : rewardType === "MOBILE_AIRTIME" ? "Airtime amount (ETB)" : "Value"}
                    <input
                      value={rewardValue}
                      onChange={(e) => setRewardValue(e.target.value)}
                      placeholder={rewardType === "PERCENT_DISCOUNT" ? "15" : rewardType === "FREE_ITEM" ? "Free Socks" : rewardType === "MOBILE_AIRTIME" ? "50" : "300"}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                    />
                  </label>
                  {(rewardType === "FIXED_CASHBACK" || rewardType === "PERCENT_DISCOUNT") && (
                    <>
                      <label className="text-xs font-semibold text-slate-600">
                        Promo code
                        <input
                          value={rewardPromoCode}
                          onChange={(e) => setRewardPromoCode(e.target.value.toUpperCase())}
                          placeholder="REWARD300"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Code expiry
                        <input
                          type="date"
                          value={rewardExpiresAt}
                          onChange={(e) => setRewardExpiresAt(e.target.value)}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm"
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
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
              disabled={busy}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
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