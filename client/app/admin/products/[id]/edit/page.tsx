// app/admin/products/[id]/edit/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import axios from "axios";
import { ArrowLeft, Save, X, Package, AlertCircle, Image as ImageIcon, Upload, Trash2, CheckCircle, XCircle, Info, Weight, FolderPlus, Clock, Calendar, Plus, Video as VideoIcon, Ruler, Gift } from "lucide-react";
import { uploadApi } from "@/lib/api";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const TOKEN_KEYS = ["token", "authToken"] as const;
const USER_KEYS = ["user"] as const;

const readToken = (): string | null => {
  if (typeof window === "undefined") return null;
  for (const k of TOKEN_KEYS) { const v = localStorage.getItem(k) || sessionStorage.getItem(k); if (v) return v; }
  return null;
};
const clearAuthStorage = () => { for (const k of [...TOKEN_KEYS, ...USER_KEYS]) { localStorage.removeItem(k); sessionStorage.removeItem(k); } };

const api = axios.create({ baseURL: API_URL, headers: { "Content-Type": "application/json" }, withCredentials: true });
api.interceptors.request.use((c) => { const t = readToken(); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (error) => {
  if (error.response?.status === 401) clearAuthStorage();
  return Promise.reject(error);
});

type MediaKind = "image" | "video";
const resolveMedia = (raw: unknown, kind: MediaKind): string | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim(); if (!s) return null;
  if (kind === "image" && s.startsWith("data:")) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("res.cloudinary.com/")) return `https://${s}`;
  return null;
};

interface ProductPrice { currency: string; amount: number; }
interface PriceRow { id: number; currency: string; amount: string; discountAmount: string; }
interface CurrencyOption { code: string; label: string; symbol: string; }
interface ProductFormData {
  name: string; description: string; sku: string; categoryId: string; subCategoryId: string; tags: string[]; images: string[]; videoUrl: string;
  weight: string; unitOfMeasurement: string; durationTime: string; stock: string;
  availabilityStatus: "AVAILABLE" | "OUT_OF_STOCK_TEMPORARY"; autoRestock: boolean;
  restockAfterDays: string; restockQuantity: string; availableAt: string; restockDate: string; saleEndDate: string;
}
interface Category { id: string; name: string; slug: string; description?: string; parentId?: string | null; }
interface ApiProduct {
  name?: string; description?: string; price?: number; currency?: string; prices?: ProductPrice[] | null;
  discountPrice?: number | null; discountPrices?: { currency: string; amount: number }[] | null;
  sku?: string; categoryId?: string; category?: { id: string } | null; subCategoryId?: string | null; subCategory?: { id: string } | null;
  tags?: string[]; images?: string[]; videoUrl?: string | null; weight?: number | null; unitOfMeasurement?: string; durationTime?: string;
  stock?: number; availabilityStatus?: string; autoRestock?: boolean; restockAfterDays?: number; restockQuantity?: number;
  availableAt?: string | null; restockDate?: string | null; saleEndDate?: string | null;
  sideProductLinks?: { sideProductId: string; bundlePrice: number | null; sideProduct?: { id: string; name: string } | null }[];
  rewardRules?: { id: string; name: string; scope: string; triggerType: string; threshold: number; rewardType: string; rewardValue: string; promoCode: string | null; expiresAt: string | null; active: boolean }[];
  sizesList?: { size: string; stock: number; sku: string | null }[];
}
interface EditProductPageProps { params: Promise<{ id: string }>; }
type AuthStatus = "checking" | "admin" | "guest" | "forbidden";
type NotificationType = "success" | "error" | "info" | "warning";

const CURRENCIES: CurrencyOption[] = [
  { code: "ETB", label: "Ethiopian Birr", symbol: "Br" }, { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "GBP", label: "British Pound", symbol: "£" }, { code: "EUR", label: "Euro", symbol: "€" },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ" }, { code: "SAR", label: "Saudi Riyal", symbol: "﷼" },
  { code: "CNY", label: "Chinese Yuan", symbol: "¥" }, { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" }, { code: "KES", label: "Kenyan Shilling", symbol: "KSh" },
  { code: "CAD", label: "Canadian Dollar", symbol: "$" }, { code: "AUD", label: "Australian Dollar", symbol: "$" },
];
const DEFAULT_CURRENCY = "ETB";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const UNIT_OPTIONS = [
  { value: "pcs", label: "Pieces (pcs)" }, { value: "set", label: "Set" }, { value: "pack", label: "Pack" }, { value: "box", label: "Box" },
  { value: "bag", label: "Bag" }, { value: "roll", label: "Roll" }, { value: "sheet", label: "Sheet" }, { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" }, { value: "ton", label: "Ton" }, { value: "liter", label: "Liter (L)" }, { value: "ml", label: "Milliliter (ml)" },
  { value: "m", label: "Meter (m)" }, { value: "cm", label: "Centimeter (cm)" }, { value: "inch", label: "Inch" }, { value: "unit", label: "Unit" },
];
const DURATION_OPTIONS = [
  { value: "30m", label: "30 Minutes" }, { value: "1h", label: "1 Hour" }, { value: "2h", label: "2 Hours" }, { value: "4h", label: "4 Hours" },
  { value: "8h", label: "8 Hours" }, { value: "12h", label: "12 Hours" }, { value: "24h", label: "24 Hours" }, { value: "2d", label: "2 Days" },
  { value: "3d", label: "3 Days" }, { value: "5d", label: "5 Days" }, { value: "7d", label: "7 Days" }, { value: "10d", label: "10 Days" },
  { value: "14d", label: "14 Days" }, { value: "21d", label: "21 Days" }, { value: "30d", label: "30 Days" }, { value: "60d", label: "60 Days" }, { value: "90d", label: "90 Days" },
];
const INPUT_CLS = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm";
const LABEL_CLS = "block text-sm font-medium text-gray-700 mb-1.5";

const formatMoney = (amount: number, currency = DEFAULT_CURRENCY) => {
  const v = Number(amount) || 0;
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
  catch { return `${currency} ${v.toFixed(2)}`; }
};
const getErrorMessage = (err: unknown, fallback: string) => axios.isAxiosError(err) ? (err.response?.data?.error || err.response?.data?.message || fallback) : err instanceof Error ? err.message : fallback;
const toCategoryList = (data: unknown): Category[] => { if (Array.isArray(data)) return data as Category[]; const obj = data as { categories?: Category[]; data?: Category[] } | null; return obj?.categories ?? obj?.data ?? []; };
const generateSKU = () => `APM-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
const generateSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const toDateTimeLocal = (iso?: string | null): string => {
  if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const buildPriceRows = (product: ApiProduct, nextId: () => number): PriceRow[] => {
  const saved = Array.isArray(product.prices) ? product.prices.filter((p) => p && typeof p.currency === "string" && Number(p.amount) > 0) : [];
  const source: ProductPrice[] = saved.length > 0 ? saved : [{ currency: product.currency || DEFAULT_CURRENCY, amount: Number(product.price) || 0 }];
  const discountMap = new Map<string, number>();
  if (Array.isArray(product.discountPrices)) for (const d of product.discountPrices) if (d && typeof d.currency === "string" && Number(d.amount) > 0) discountMap.set(d.currency.toUpperCase(), Number(d.amount));
  if (discountMap.size === 0 && product.discountPrice && product.discountPrice > 0) discountMap.set((product.currency || DEFAULT_CURRENCY).toUpperCase(), Number(product.discountPrice));
  return source.map((p) => ({ id: nextId(), currency: p.currency, amount: p.amount > 0 ? String(p.amount) : "", discountAmount: discountMap.has(p.currency.toUpperCase()) ? String(discountMap.get(p.currency.toUpperCase())) : "" }));
};
const getRowCurrencyOptions = (rowCurrency: string, used: string[]): CurrencyOption[] => {
  const opts = CURRENCIES.filter((c) => c.code === rowCurrency || !used.includes(c.code));
  if (!CURRENCIES.some((c) => c.code === rowCurrency)) opts.unshift({ code: rowCurrency, label: rowCurrency, symbol: rowCurrency });
  return opts;
};

const getAuthSnapshot = (): AuthStatus => {
  if (typeof window === "undefined") return "checking";
  const token = readToken(); const userData = localStorage.getItem("user") || sessionStorage.getItem("user");
  if (!token || !userData) return "guest";
  try { const parsed = JSON.parse(userData); return String(parsed?.role || "").toUpperCase() === "ADMIN" ? "admin" : "forbidden"; } catch { return "guest"; }
};
const subscribeAuth = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => { if (!e.key || ([...TOKEN_KEYS, ...USER_KEYS] as string[]).includes(e.key)) cb(); };
  window.addEventListener("storage", handler); return () => window.removeEventListener("storage", handler);
};
const getAuthServerSnapshot = (): AuthStatus => "checking";

const NOTIF_STYLES: Record<NotificationType, string> = {
  success: "bg-yellow-50 border-yellow-200 text-yellow-800", error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800", info: "bg-blue-50 border-blue-200 text-blue-800",
};
const NOTIF_ICONS: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-yellow-500" />, error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-yellow-500" />, info: <Info className="w-5 h-5 text-blue-500" />,
};
const Notification: React.FC<{ type: NotificationType; message: string; onClose: () => void }> = ({ type, message, onClose }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}`}>
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${NOTIF_STYLES[type]}`}>
        {NOTIF_ICONS[type]}<p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="text-gray-400 hover:text-gray-600 transition-colors"><XCircle className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const ProductImage: React.FC<{ src: string | null; alt: string; index?: number }> = ({ src, alt, index = 0 }) => {
  const [failed, setFailed] = useState(false); const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) { setLastSrc(src); setFailed(false); }
  if (!src || failed) return <div className="w-full h-full flex items-center justify-center bg-gray-100"><ImageIcon className="w-8 h-8 text-gray-400" /></div>;
  return <Image src={src} alt={alt} width={200} height={200} className="w-full h-full object-cover" onError={() => setFailed(true)} unoptimized priority={index === 0} />;
};

const AddCategoryForm: React.FC<{ onClose: () => void; onCategoryAdded: (c: Category) => void; title: string; isSubCategory?: boolean; parentCategoryId?: string; parentCategoryName?: string }> = ({ onClose, onCategoryAdded, title, isSubCategory = false, parentCategoryId = "", parentCategoryName = "" }) => {
  const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const handleNameChange = (v: string) => { setName(v); setSlug(v ? generateSlug(v) : ""); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim() || !slug.trim()) return;
    setLoading(true); setError(null);
    try {
      const payload: Record<string, string> = { name: name.trim(), slug: slug.trim() };
      if (description.trim()) payload.description = description.trim();
      if (isSubCategory && parentCategoryId) payload.parentId = parentCategoryId;
      const { data } = await api.post("/api/categories", payload);
      onCategoryAdded(data?.category || data); onClose();
    } catch (err) { setError(getErrorMessage(err, `Failed to create ${isSubCategory ? "subcategory" : "category"}`)); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-gray-900">{title}</h3><button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" type="button"><X className="w-5 h-5" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSubCategory && (<div><label className={LABEL_CLS}>Parent Category <span className="text-red-500">*</span></label><input value={parentCategoryName || "—"} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm cursor-not-allowed" /></div>)}
          <div><label className={LABEL_CLS}>Name <span className="text-red-500">*</span></label><input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} required placeholder={`Enter ${isSubCategory ? "subcategory" : "category"} name`} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm" /></div>
          <div><label className={LABEL_CLS}>Slug <span className="text-red-500">*</span></label><input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} required placeholder="auto-generated" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm bg-gray-50" /><p className="text-xs text-gray-400 mt-1">URL-friendly version</p></div>
          <div><label className={LABEL_CLS}>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm" /></div>
          {error && (<div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>)}
          <div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button><button type="submit" disabled={loading || !name.trim() || !slug.trim()} className="px-4 py-2 text-sm text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Creating..." : `Create ${isSubCategory ? "Subcategory" : "Category"}`}</button></div>
        </form>
      </div>
    </div>
  );
};
const AddCategoryModal: React.FC<{ isOpen: boolean; onClose: () => void; onCategoryAdded: (c: Category) => void; title: string; isSubCategory?: boolean; parentCategoryId?: string; parentCategoryName?: string }> = ({ isOpen, ...rest }) => isOpen ? <AddCategoryForm {...rest} /> : null;

const PriceRowInput: React.FC<{ row: PriceRow; index: number; usedCurrencies: string[]; canRemove: boolean; onUpdate: (id: number, changes: Partial<PriceRow>) => void; onRemove: (id: number) => void }> = ({ row, index, usedCurrencies, canRemove, onUpdate, onRemove }) => {
  const amount = Number(row.amount); const valid = Number.isFinite(amount) && amount > 0;
  return (
    <div>
      <div className="flex items-center space-x-2">
        <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-yellow-500">
          <select aria-label={`Currency ${index + 1}`} value={row.currency} onChange={(e) => onUpdate(row.id, { currency: e.target.value })} className="w-32 shrink-0 border-0 border-r border-gray-200 bg-gray-50 px-2 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none">
            {getRowCurrencyOptions(row.currency, usedCurrencies).map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </select>
          <input type="number" min="0.01" step="0.01" value={row.amount} onChange={(e) => onUpdate(row.id, { amount: e.target.value })} placeholder="0.00" aria-label={`Price amount ${index + 1}`} className="min-w-0 flex-1 border-0 px-4 py-2.5 text-sm focus:outline-none" />
        </div>
        <div className="flex flex-1 items-stretch overflow-hidden rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-yellow-500">
          <span className="flex items-center border-0 border-r border-gray-200 bg-gray-50 px-2 py-2.5 text-xs font-semibold text-gray-500">Disc</span>
          <input type="number" min="0" step="0.01" value={row.discountAmount} onChange={(e) => onUpdate(row.id, { discountAmount: e.target.value })} placeholder="0.00" aria-label={`Discount amount ${index + 1}`} className="min-w-0 flex-1 border-0 px-4 py-2.5 text-sm focus:outline-none" />
        </div>
        <button type="button" onClick={() => onRemove(row.id)} disabled={!canRemove} aria-label={`Remove price ${index + 1}`} className="p-2.5 text-red-500 border border-gray-200 rounded-lg hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {index === 0 ? "Main price" : "Additional price"}{valid ? `: ${formatMoney(amount, row.currency)}` : ""}
        {row.discountAmount.trim() !== "" && Number(row.discountAmount) > 0 && Number(row.discountAmount) < amount ? ` · Disc: ${formatMoney(Number(row.discountAmount), row.currency)} · Save: ${formatMoney(amount - Number(row.discountAmount), row.currency)}` : ""}
      </p>
    </div>
  );
};

const SummaryRow: React.FC<{ label: string; children: React.ReactNode; last?: boolean }> = ({ label, children, last }) => (
  <div className={`flex justify-between py-1 ${last ? "" : "border-b border-gray-100"}`}>
    <span className="text-gray-500">{label}:</span><span className="font-medium text-gray-700 truncate max-w-[140px] text-right">{children}</span>
  </div>
);

const EditProductPage: React.FC<EditProductPageProps> = ({ params }) => {
  const router = useRouter(); const { id: productId } = use(params);
  const fileInputRef = useRef<HTMLInputElement>(null); const videoInputRef = useRef<HTMLInputElement>(null); const rowCounter = useRef(0);
  const authStatus = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot); const isAdmin = authStatus === "admin";
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false); const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null); const [notification, setNotification] = useState<{ type: NotificationType; message: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]); const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false); const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [newTag, setNewTag] = useState(""); const [deletingCategory, setDeletingCategory] = useState(false);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([{ id: 0, currency: DEFAULT_CURRENCY, amount: "", discountAmount: "" }]);
  const [formData, setFormData] = useState<ProductFormData>({ name: "", description: "", sku: "", categoryId: "", subCategoryId: "", tags: [], images: [], videoUrl: "", weight: "", unitOfMeasurement: "pcs", durationTime: "1h", stock: "0", availabilityStatus: "AVAILABLE", autoRestock: true, restockAfterDays: "2", restockQuantity: "10", availableAt: "", restockDate: "", saleEndDate: "" });
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [sideProducts, setSideProducts] = useState<{ productId: string; bundlePrice: string }[]>([]);
  const [sizeVariants, setSizeVariants] = useState<{ size: string; stock: string; sku: string }[]>([]);
  const [rewardEnabled, setRewardEnabled] = useState(false); const [rewardRuleId, setRewardRuleId] = useState<string | null>(null);
  const [rewardTriggerType, setRewardTriggerType] = useState<"MIN_QUANTITY" | "MIN_SPEND">("MIN_QUANTITY");
  const [rewardThreshold, setRewardThreshold] = useState("");
  const [rewardType, setRewardType] = useState<"FIXED_CASHBACK" | "PERCENT_DISCOUNT" | "FREE_ITEM" | "CUSTOM" | "MOBILE_AIRTIME">("FIXED_CASHBACK");
  const [rewardValue, setRewardValue] = useState(""); const [rewardPromoCode, setRewardPromoCode] = useState(""); const [rewardExpiresAt, setRewardExpiresAt] = useState("");

  useEffect(() => {
    api.get("/api/products").then((res) => {
      const list = Array.isArray(res.data) ? res.data : res.data?.products || [];
      setAllProducts((Array.isArray(list) ? list : []).map((p: { id?: unknown; name?: unknown }) => ({ id: String(p.id ?? ""), name: String(p.name ?? "") })).filter((p) => p.id && p.name));
    }).catch(() => {});
  }, []);

  const busy = saving || uploadingImage || uploadingVideo || deletingCategory;
  const usedCurrencies = useMemo(() => priceRows.map((r) => r.currency), [priceRows]);
  const canAddCurrency = useMemo(() => CURRENCIES.some((c) => !usedCurrencies.includes(c.code)), [usedCurrencies]);
  const previewVideo = useMemo(() => resolveMedia(formData.videoUrl, "video"), [formData.videoUrl]);
  const notify = useCallback((type: NotificationType, message: string) => setNotification({ type, message }), []);
  const clearNotification = useCallback(() => setNotification(null), []);
  const nextRowId = useCallback(() => { rowCounter.current += 1; return rowCounter.current; }, []);

  useEffect(() => {
    if (authStatus === "guest" || authStatus === "forbidden") {
      const url = authStatus === "guest" ? "/auth/signin" : "/";
      const t = window.setTimeout(() => router.replace(url), 0); return () => window.clearTimeout(t);
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (!isAdmin) return; let ignore = false;
    (async () => { try { const res = await api.get("/api/categories"); if (!ignore) setCategories(toCategoryList(res.data).filter((c) => !c.parentId)); } catch (err) { if (!ignore) console.log("Categories fetch error:", err); } })();
    return () => { ignore = true; };
  }, [isAdmin]);

  const fetchSubCategories = useCallback(async (parentId: string) => {
    if (!parentId) { setSubCategories([]); return; }
    try { const res = await api.get(`/api/categories?parentId=${parentId}`); setSubCategories(toCategoryList(res.data)); }
    catch { try { const res = await api.get("/api/categories"); setSubCategories(toCategoryList(res.data).filter((c) => c.parentId === parentId)); } catch (err) { console.log("Subcategories fetch error:", err); } }
  }, []);

  useEffect(() => {
    if (!isAdmin) return; let active = true;
    api.get(`/api/products/${productId}`).then((res) => {
      if (!active) return;
      const product: ApiProduct | null = res.data?.product ?? res.data?.data ?? res.data;
      if (!product) { setError("Product not found"); return; }
      const categoryId = product.categoryId || product.category?.id || "";
      const subCategoryId = product.subCategoryId || product.subCategory?.id || "";
      setFormData({
        name: product.name || "", description: product.description || "", sku: product.sku || generateSKU(), categoryId, subCategoryId,
        tags: product.tags || [], images: product.images || [], videoUrl: product.videoUrl || "", weight: product.weight?.toString() || "",
        unitOfMeasurement: product.unitOfMeasurement || "pcs", durationTime: product.durationTime || "1h", stock: product.stock?.toString() || "0",
        availabilityStatus: product.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" ? "OUT_OF_STOCK_TEMPORARY" : "AVAILABLE",
        autoRestock: product.autoRestock !== false, restockAfterDays: product.restockAfterDays?.toString() || "2", restockQuantity: product.restockQuantity?.toString() || "10",
        availableAt: toDateTimeLocal(product.availableAt), restockDate: toDateTimeLocal(product.restockDate), saleEndDate: toDateTimeLocal(product.saleEndDate),
      });
      setPriceRows(buildPriceRows(product, nextRowId));
      setSideProducts((product.sideProductLinks || []).map((link) => ({ productId: link.sideProductId, bundlePrice: link.bundlePrice != null ? String(link.bundlePrice) : "" })));
      setSizeVariants((product.sizesList || []).map((s) => ({ size: s.size, stock: String(s.stock ?? 0), sku: s.sku || "" })));
      const existingRule = (product.rewardRules || [])[0];
      if (existingRule) {
        setRewardRuleId(existingRule.id); setRewardEnabled(existingRule.active);
        setRewardTriggerType(existingRule.triggerType === "MIN_SPEND" ? "MIN_SPEND" : "MIN_QUANTITY");
        setRewardThreshold(String(Number(existingRule.threshold ?? 0)));
        setRewardType((["FIXED_CASHBACK", "PERCENT_DISCOUNT", "FREE_ITEM", "CUSTOM", "MOBILE_AIRTIME"] as const).includes(existingRule.rewardType as never) ? (existingRule.rewardType as typeof rewardType) : "FIXED_CASHBACK");
        setRewardValue(existingRule.rewardValue || ""); setRewardPromoCode(existingRule.promoCode || ""); setRewardExpiresAt(existingRule.expiresAt ? existingRule.expiresAt.slice(0, 10) : "");
      }
      if (categoryId) void fetchSubCategories(categoryId);
    }).catch((err) => {
      if (!active) return; console.error("Fetch error:", err);
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 404) setError("Product not found. Please check the product ID.");
        else if (status === 401 || status === 403) router.push("/auth/signin");
        else setError(err.response?.data?.error || `Failed to load product (Status: ${status})`);
      } else setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isAdmin, productId, router, fetchSubCategories, nextRowId]);

  const addPriceRow = useCallback(() => { const next = CURRENCIES.find((c) => !usedCurrencies.includes(c.code)); if (!next) return; setPriceRows((rows) => [...rows, { id: nextRowId(), currency: next.code, amount: "", discountAmount: "" }]); }, [usedCurrencies, nextRowId]);
  const updatePriceRow = useCallback((id: number, changes: Partial<PriceRow>) => { setPriceRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...changes } : r))); }, []);
  const removePriceRow = useCallback((id: number) => { setPriceRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows)); }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (files.length === 0) return;
    setUploadingImage(true);
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("Only JPG, PNG, WEBP, or GIF images are allowed.");
        if (file.size > MAX_IMAGE_SIZE) throw new Error("Each image must be smaller than 10 MB.");
        const response = await uploadApi.uploadProductImage(file); const url = response.url || response.secure_url;
        if (!url) throw new Error(response.message || "An image could not be uploaded."); return url;
      }));
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...uploaded] }));
      notify("success", uploaded.length === 1 ? "Image uploaded successfully" : `${uploaded.length} images uploaded successfully`);
    } catch (err) { notify("error", getErrorMessage(err, "Failed to upload image")); }
    finally { setUploadingImage(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setUploadingVideo(true);
    try {
      if (!file.type.startsWith("video/")) throw new Error("Choose a video file only (MP4, WEBM, or MOV).");
      if (file.size > MAX_VIDEO_SIZE) throw new Error("The video must be smaller than 100 MB.");
      const response = await uploadApi.uploadProductVideo(file); const url = response.url || response.secure_url;
      if (!url) throw new Error(response.message || "The video could not be uploaded.");
      setFormData((prev) => ({ ...prev, videoUrl: url })); notify("success", "Video uploaded successfully");
    } catch (err) { notify("error", getErrorMessage(err, "Failed to upload video")); }
    finally { setUploadingVideo(false); if (videoInputRef.current) videoInputRef.current.value = ""; }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "categoryId") { setFormData((prev) => ({ ...prev, categoryId: value, subCategoryId: "" })); void fetchSubCategories(value); return; }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  const handleAddTag = () => { const tag = newTag.trim(); if (!tag || formData.tags.includes(tag)) return; setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] })); notify("success", `Tag "${tag}" added`); setNewTag(""); };
  const handleRemoveTag = (tag: string) => { setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) })); notify("info", `Tag "${tag}" removed`); };
  const handleRemoveImage = (index: number) => { setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) })); notify("info", "Image removed"); };
  const handleRemoveVideo = () => { setFormData((prev) => ({ ...prev, videoUrl: "" })); notify("info", "Video removed"); };
  const handleCategoryAdded = (newCategory: Category) => {
    if (newCategory.parentId) { setSubCategories((prev) => [...prev, newCategory]); setFormData((prev) => ({ ...prev, subCategoryId: newCategory.id })); notify("success", `Subcategory "${newCategory.name}" created and selected`); }
    else { setCategories((prev) => [...prev, newCategory]); setFormData((prev) => ({ ...prev, categoryId: newCategory.id })); notify("success", `Category "${newCategory.name}" created and selected`); }
  };
  const handleGenerateSKU = () => { const sku = generateSKU(); setFormData((prev) => ({ ...prev, sku })); notify("info", `New SKU generated: ${sku}`); };

  const handleDeleteCategory = async () => {
    if (!formData.categoryId) return; const categoryToDelete = categories.find((c) => c.id === formData.categoryId); if (!categoryToDelete) return;
    if (!confirm(`Are you sure you want to delete the category "${categoryToDelete.name}"? This cannot be undone.`)) return;
    setDeletingCategory(true);
    try {
      await api.delete(`/api/categories/${formData.categoryId}`);
      setCategories((prev) => prev.filter((c) => c.id !== formData.categoryId));
      setFormData((prev) => ({ ...prev, categoryId: "", subCategoryId: "" })); setSubCategories([]); notify("success", "Category deleted successfully.");
    } catch (err) { notify("error", getErrorMessage(err, "Failed to delete category. It might have products assigned to it.")); }
    finally { setDeletingCategory(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prices: ProductPrice[] = priceRows.map((r) => ({ currency: r.currency, amount: Number(r.amount) }));
    if (prices.some((p) => !Number.isFinite(p.amount) || p.amount <= 0)) { notify("error", "Enter a valid price greater than 0 for every currency."); return; }
    const primary = prices[0]; const discountPrices: { currency: string; amount: number }[] = [];
    for (const row of priceRows) {
      if (row.discountAmount.trim() !== "") {
        const dAmount = Number(row.discountAmount); const original = Number(row.amount);
        if (!Number.isFinite(dAmount) || dAmount <= 0 || dAmount >= original) { notify("error", `Discount for ${row.currency} must be greater than 0 and less than its price (${original}).`); return; }
        discountPrices.push({ currency: row.currency, amount: dAmount });
      }
    }
    setSaving(true);
    try {
      const submitData = {
        name: formData.name.trim(), description: formData.description.trim(), price: primary.amount, pricePerUnit: primary.amount, currency: primary.currency, prices, discountPrices,
        sku: formData.sku, categoryId: formData.categoryId, subCategoryId: formData.subCategoryId || undefined, tags: formData.tags, images: formData.images, videoUrl: formData.videoUrl || null,
        weight: formData.weight ? parseFloat(formData.weight) : null, unitOfMeasurement: formData.unitOfMeasurement || "pcs", durationTime: formData.durationTime || "1h",
        stock: Number(formData.stock) || 0, availabilityStatus: formData.availabilityStatus, autoRestock: formData.autoRestock,
        restockAfterDays: Number(formData.restockAfterDays) || 2, restockQuantity: Number(formData.restockQuantity) || 10,
        availableAt: formData.availableAt || null, restockDate: formData.restockDate || null, saleEndDate: formData.saleEndDate || null,
        sideProducts: sideProducts.filter((s) => s.productId).map((s) => ({ productId: s.productId, bundlePrice: s.bundlePrice.trim() === "" ? null : Number(s.bundlePrice) })),
        sizeVariants: sizeVariants.filter((s) => s.size.trim() !== "").map((s) => ({ size: s.size.trim(), stock: Number(s.stock) || 0, sku: s.sku.trim() || undefined })),
      };
      const { data } = await api.put(`/api/products/${productId}`, submitData);
      if (data.success) {
        const thresholdNum = Number(rewardThreshold);
        const rewardPayload = { name: `${formData.name.trim()} — purchase reward`, scope: "PRODUCT", productId, triggerType: rewardTriggerType, threshold: thresholdNum, minSpend: rewardTriggerType === "MIN_SPEND" ? thresholdNum : null, rewardType, rewardValue: rewardValue.trim(), currency: primary.currency, promoCode: rewardPromoCode.trim() || null, expiresAt: rewardExpiresAt || null, active: rewardEnabled };
        try {
          if (rewardEnabled && Number.isFinite(thresholdNum) && thresholdNum > 0 && rewardValue.trim()) {
            if (rewardRuleId) await api.patch(`/api/admin/rewards/rules/${rewardRuleId}`, rewardPayload);
            else await api.post("/api/admin/rewards/rules", rewardPayload);
          } else if (!rewardEnabled && rewardRuleId) await api.patch(`/api/admin/rewards/rules/${rewardRuleId}`, { active: false });
        } catch (rewardErr) { console.warn("Product saved but reward sync failed:", rewardErr); }
        notify("success", "Product updated successfully! 🎉"); setTimeout(() => router.push("/admin/products"), 1500);
      } else notify("error", data.error || "Failed to update product");
    } catch (err) { notify("error", getErrorMessage(err, "Failed to update product")); }
    finally { setSaving(false); }
  };

  if (authStatus === "checking") return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto" /><p className="mt-4 text-gray-600">Checking authentication...</p></div></div>;
  if (!isAdmin) return null;
  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto" /><p className="mt-4 text-gray-600">Loading product...</p></div></div>;
  if (error) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center max-w-md"><div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" /><p className="text-red-600 font-medium">{error}</p></div><div className="flex justify-center space-x-3"><Link href="/admin/products" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Back to Products</Link><button onClick={() => router.refresh()} className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Retry</button></div></div></div>;

  return (
    <div className="space-y-6">
      {notification && <Notification type={notification.type} message={notification.message} onClose={clearNotification} />}
      <AddCategoryModal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} onCategoryAdded={handleCategoryAdded} title="Add New Category" />
      <AddCategoryModal isOpen={showSubCategoryModal} onClose={() => setShowSubCategoryModal(false)} onCategoryAdded={handleCategoryAdded} title="Add New Subcategory" isSubCategory parentCategoryId={formData.categoryId} parentCategoryName={categories.find((c) => c.id === formData.categoryId)?.name || ""} />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/products" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <div><h1 className="text-lg font-semibold text-gray-900">Edit Product</h1><p className="text-xs text-gray-500 mt-0.5">Update product details and inventory</p></div>
        </div>
        <Link href="/admin/products" className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 mb-6"><Package className="w-5 h-5 text-yellow-500" /><h3 className="font-semibold text-gray-900">Product Information</h3></div>
              <div className="space-y-5">
                <div><label className={LABEL_CLS}>Product Name <span className="text-red-500">*</span></label><input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., Heavy-Duty Storage Bin" className={INPUT_CLS} /></div>
                <div><label className={LABEL_CLS}>Description <span className="text-red-500">*</span></label><textarea name="description" value={formData.description} onChange={handleChange} rows={4} required placeholder="Describe your plastic product in detail..." className={INPUT_CLS} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Category <span className="text-red-500">*</span></label>
                    <div className="flex space-x-2">
                      <select name="categoryId" value={formData.categoryId} onChange={handleChange} required className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"><option value="">Select Category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                      <button type="button" onClick={() => setShowCategoryModal(true)} className="px-3 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap flex items-center space-x-1"><FolderPlus className="w-4 h-4" /><span>New</span></button>
                      <button type="button" onClick={() => void handleDeleteCategory()} disabled={!formData.categoryId || deletingCategory} className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm whitespace-nowrap flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed" title="Delete selected category">{deletingCategory ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Sub Category</label>
                    <div className="flex space-x-2">
                      <select name="subCategoryId" value={formData.subCategoryId} onChange={handleChange} disabled={!formData.categoryId} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm disabled:bg-gray-50"><option value="">Select Sub Category</option>{subCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                      <button type="button" onClick={() => { if (!formData.categoryId) { notify("warning", "Please select a category first"); return; } setShowSubCategoryModal(true); }} className="px-3 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap flex items-center space-x-1"><FolderPlus className="w-4 h-4" /><span>New</span></button>
                    </div>
                  </div>
                </div>
                <div><label className={LABEL_CLS}>SKU</label><div className="flex items-center space-x-2"><input type="text" name="sku" value={formData.sku} onChange={handleChange} className={`${INPUT_CLS} flex-1`} /><button type="button" onClick={handleGenerateSKU} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap">Generate</button></div></div>
                <div><label className={LABEL_CLS}><span className="flex items-center space-x-2"><Clock className="w-4 h-4 text-gray-500" /><span>Listing Duration</span></span></label><select name="durationTime" value={formData.durationTime || "1h"} onChange={handleChange} className={INPUT_CLS}>{DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div><label className={LABEL_CLS}>Weight & Unit <span className="text-xs text-gray-400">(e.g., 1 kg of plastic resin)</span></label><div className="flex space-x-2"><div className="flex-1 relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Weight className="w-4 h-4" /></span><input type="number" name="weight" value={formData.weight} onChange={handleChange} step="0.01" placeholder="0.00" className={`${INPUT_CLS} pl-9`} /></div><select name="unitOfMeasurement" value={formData.unitOfMeasurement} onChange={handleChange} className="w-48 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm">{UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div></div>
                <div><label className={LABEL_CLS}>Prices <span className="text-red-500">*</span></label><div className="space-y-3">{priceRows.map((row, index) => <PriceRowInput key={row.id} row={row} index={index} usedCurrencies={usedCurrencies} canRemove={priceRows.length > 1} onUpdate={updatePriceRow} onRemove={removePriceRow} />)}</div><button type="button" onClick={addPriceRow} disabled={!canAddCurrency} className="mt-3 inline-flex items-center space-x-1.5 px-3 py-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="w-4 h-4" /><span>Add another currency</span></button></div>
                <p className="text-xs text-gray-500 md:w-1/2"><strong>Price</strong> = original price (e.g., 688). <strong>Disc</strong> = discount price customers pay (e.g., 89). Customer sees: 89 (was 688, save 599). Leave Disc empty for no discount.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className={LABEL_CLS}>Stock quantity <span className="text-red-500">*</span></label><input type="number" name="stock" value={formData.stock} onChange={(e) => setFormData((prev) => ({ ...prev, stock: e.target.value }))} min="0" step="1" required className={INPUT_CLS} /></div>
                  <div><label className={LABEL_CLS}>Availability status</label><div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFormData((prev) => ({ ...prev, availabilityStatus: "AVAILABLE" }))} className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${formData.availabilityStatus === "AVAILABLE" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}><span className={`h-2 w-2 rounded-full ${formData.availabilityStatus === "AVAILABLE" ? "bg-emerald-500" : "bg-gray-300"}`} />Available now</button>
                    <button type="button" onClick={() => setFormData((prev) => ({ ...prev, availabilityStatus: "OUT_OF_STOCK_TEMPORARY" }))} className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${formData.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}><span className={`h-2 w-2 rounded-full ${formData.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" ? "bg-amber-500" : "bg-gray-300"}`} />Out of stock temporarily</button>
                  </div></div>
                </div>
                {formData.availabilityStatus === "OUT_OF_STOCK_TEMPORARY" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm text-amber-800"><input type="checkbox" checked={formData.autoRestock} onChange={(e) => setFormData((prev) => ({ ...prev, autoRestock: e.target.checked }))} className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" />Auto-restock after a set number of days</label>
                    {formData.autoRestock && (
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-medium text-amber-700">Restock after (days)</label><input type="number" min="1" value={formData.restockAfterDays} onChange={(e) => setFormData((prev) => ({ ...prev, restockAfterDays: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-amber-200 bg-white px-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" /></div>
                        <div><label className="text-xs font-medium text-amber-700">Restock quantity</label><input type="number" min="1" value={formData.restockQuantity} onChange={(e) => setFormData((prev) => ({ ...prev, restockQuantity: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-amber-200 bg-white px-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400" /></div>
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-700">Stock &amp; countdown dates <span className="font-normal text-gray-400">(optional — powers live countdowns on the shop)</span></p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className={LABEL_CLS}>Available / arrival date</label><input type="datetime-local" value={formData.availableAt} onChange={(e) => setFormData((prev) => ({ ...prev, availableAt: e.target.value }))} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Restock date</label><input type="datetime-local" value={formData.restockDate} onChange={(e) => setFormData((prev) => ({ ...prev, restockDate: e.target.value }))} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Sale / offer ends</label><input type="datetime-local" value={formData.saleEndDate} onChange={(e) => setFormData((prev) => ({ ...prev, saleEndDate: e.target.value }))} className={INPUT_CLS} /></div>
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Tags</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.tags.map((tag) => <span key={tag} className="inline-flex items-center space-x-1 px-3 py-1.5 bg-yellow-50 text-yellow-700 text-sm rounded-full border border-yellow-200"><span>{tag}</span><button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-600"><X className="w-3 h-3" /></button></span>)}
                    {formData.tags.length === 0 && <span className="text-sm text-gray-400">No tags added</span>}
                  </div>
                  <div className="flex space-x-2">
                    <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }} placeholder="Add a tag..." className={`${INPUT_CLS} flex-1`} />
                    <button type="button" onClick={handleAddTag} className="px-4 py-2.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 text-sm whitespace-nowrap">Add Tag</button>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                <button type="submit" disabled={busy} className="flex items-center space-x-2 px-6 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}<span>{saving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 mb-4"><ImageIcon className="w-4 h-4 text-yellow-500" /><h3 className="font-semibold text-gray-900 text-sm">Images</h3><span className="text-xs text-gray-400 ml-auto">{formData.images.length} uploaded</span></div>
              <div className="grid grid-cols-2 gap-2">
                {formData.images.map((img, index) => (
                  <div key={`${img}-${index}`} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
                    <ProductImage src={resolveMedia(img, "image")} alt={`Product ${index + 1}`} index={index} />
                    <button type="button" onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 z-10"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <div onClick={() => fileInputRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-yellow-500 cursor-pointer group">
                  <div className="text-center">{uploadingImage ? <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto" /> : <><Upload className="w-8 h-8 text-gray-400 mx-auto group-hover:text-yellow-500" /><span className="text-xs text-gray-500 group-hover:text-yellow-500">Upload</span></>}</div>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/gif" onChange={handleImageUpload} className="hidden" multiple />
              {formData.images.length === 0 && <p className="text-xs text-gray-400 mt-2 text-center">Click to upload images (max 10MB each)</p>}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 mb-4"><VideoIcon className="w-4 h-4 text-yellow-500" /><h3 className="font-semibold text-gray-900 text-sm">Product Video</h3><span className="text-xs text-gray-400 ml-auto">Optional</span></div>
              {previewVideo ? (
                <div className="relative overflow-hidden rounded-lg bg-black">
                  <video src={previewVideo} controls playsInline preload="metadata" className="max-h-52 w-full" />
                  <button type="button" onClick={handleRemoveVideo} aria-label="Remove video" className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-600 rounded-full shadow hover:bg-white"><Trash2 className="w-4 h-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo} className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-yellow-500 hover:text-yellow-600 disabled:opacity-50">
                  {uploadingVideo ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500" /> : <VideoIcon className="w-6 h-6" />}<span className="text-xs">{uploadingVideo ? "Uploading video..." : "Upload video"}</span>
                </button>
              )}
              <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={handleVideoUpload} className="hidden" />
              <p className="text-xs text-gray-400 mt-2">MP4, WEBM, or MOV; up to 100 MB.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2"><Package className="w-4 h-4 text-yellow-500" /><h3 className="font-semibold text-gray-900 text-sm">Side / Add-on Products</h3><span className="text-xs text-gray-400">Optional</span></div>
                <button type="button" onClick={() => setSideProducts((rows) => [...rows, { productId: "", bundlePrice: "" }])} className="inline-flex h-8 items-center gap-1 rounded-lg border border-yellow-500 px-2.5 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-50"><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
              {sideProducts.length === 0 ? <p className="text-xs text-gray-400">No side products linked.</p> : (
                <div className="space-y-2">
                  {sideProducts.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select value={row.productId} onChange={(e) => setSideProducts((rows) => rows.map((r, i) => (i === index ? { ...r, productId: e.target.value } : r)))} className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-yellow-500"><option value="">Select product…</option>{allProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      <input type="number" min="0" step="0.01" value={row.bundlePrice} onChange={(e) => setSideProducts((rows) => rows.map((r, i) => (i === index ? { ...r, bundlePrice: e.target.value } : r)))} placeholder="Bundle price" className="h-10 w-32 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-yellow-500" />
                      <button type="button" onClick={() => setSideProducts((rows) => rows.filter((_, i) => i !== index))} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" aria-label="Remove side product"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2"><Ruler className="w-4 h-4 text-yellow-500" /><h3 className="font-semibold text-gray-900 text-sm">Size Variants &amp; Stock</h3><span className="text-xs text-gray-400">Optional</span></div>
                <button type="button" onClick={() => setSizeVariants((rows) => [...rows, { size: "", stock: "0", sku: "" }])} className="inline-flex h-8 items-center gap-1 rounded-lg border border-yellow-500 px-2.5 text-xs font-semibold text-yellow-700 transition hover:bg-yellow-50"><Plus className="w-3.5 h-3.5" /> Add size</button>
              </div>
              {sizeVariants.length === 0 ? <p className="text-xs text-gray-400">No size variants defined.</p> : (
                <div className="space-y-2">
                  {sizeVariants.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input value={row.size} onChange={(e) => setSizeVariants((rows) => rows.map((r, i) => (i === index ? { ...r, size: e.target.value } : r)))} placeholder="Size (e.g. M)" className="h-10 w-28 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-yellow-500" />
                      <input type="number" min="0" step="1" value={row.stock} onChange={(e) => setSizeVariants((rows) => rows.map((r, i) => (i === index ? { ...r, stock: e.target.value } : r)))} placeholder="Stock" className="h-10 w-24 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-yellow-500" />
                      <input value={row.sku} onChange={(e) => setSizeVariants((rows) => rows.map((r, i) => (i === index ? { ...r, sku: e.target.value } : r)))} placeholder="SKU (optional)" className="h-10 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none focus:border-yellow-500" />
                      <button type="button" onClick={() => setSizeVariants((rows) => rows.filter((_, i) => i !== index))} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" aria-label="Remove size"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#EB6D3D]/40 p-5 shadow-sm hover:shadow-md transition-shadow">
              <button type="button" onClick={() => setRewardEnabled((v) => !v)} className="flex w-full items-center justify-between">
                <div className="flex items-center space-x-2"><Gift className="w-4 h-4 text-[#cf5427]" /><h3 className="font-semibold text-gray-900 text-sm">Product Purchase Reward (Optional)</h3></div>
                <span className="text-xs font-semibold text-[#cf5427]">{rewardEnabled ? "Hide" : "Configure"}</span>
              </button>
              {rewardEnabled && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div><label className="text-xs font-semibold text-gray-600">Trigger</label><select value={rewardTriggerType} onChange={(e) => setRewardTriggerType(e.target.value as typeof rewardTriggerType)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="MIN_QUANTITY">Buy ≥ quantity</option><option value="MIN_SPEND">Spend ≥ ETB</option></select></div>
                  <div><label className="text-xs font-semibold text-gray-600">{rewardTriggerType === "MIN_QUANTITY" ? "Min. quantity" : "Min. spend (ETB)"}</label><input type="number" min="0" step={rewardTriggerType === "MIN_QUANTITY" ? "1" : "0.01"} value={rewardThreshold} onChange={(e) => setRewardThreshold(e.target.value)} placeholder={rewardTriggerType === "MIN_QUANTITY" ? "2" : "5000"} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm" /></div>
                  <div><label className="text-xs font-semibold text-gray-600">Reward type</label><select value={rewardType} onChange={(e) => setRewardType(e.target.value as typeof rewardType)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"><option value="FIXED_CASHBACK">Fixed Cashback (ETB)</option><option value="PERCENT_DISCOUNT">Percentage Discount (%)</option><option value="FREE_ITEM">Free Bonus Item</option><option value="MOBILE_AIRTIME">Mobile Airtime (ETB)</option><option value="CUSTOM">Custom</option></select></div>
                  <div><label className="text-xs font-semibold text-gray-600">{rewardType === "PERCENT_DISCOUNT" ? "Percent (%)" : rewardType === "FREE_ITEM" ? "Gift name" : rewardType === "MOBILE_AIRTIME" ? "Airtime amount (ETB)" : "Value"}</label><input value={rewardValue} onChange={(e) => setRewardValue(e.target.value)} placeholder={rewardType === "PERCENT_DISCOUNT" ? "15" : rewardType === "FREE_ITEM" ? "Free Socks" : rewardType === "MOBILE_AIRTIME" ? "50" : "300"} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm" /></div>
                  {(rewardType === "FIXED_CASHBACK" || rewardType === "PERCENT_DISCOUNT") && (<><div><label className="text-xs font-semibold text-gray-600">Promo code</label><input value={rewardPromoCode} onChange={(e) => setRewardPromoCode(e.target.value.toUpperCase())} placeholder="REWARD300" className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm" /></div><div><label className="text-xs font-semibold text-gray-600">Code expiry</label><input type="date" value={rewardExpiresAt} onChange={(e) => setRewardExpiresAt(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm" /></div></>)}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 mb-4"><Calendar className="w-4 h-4 text-purple-600" /><h3 className="font-semibold text-gray-900 text-sm">Duration Info</h3></div>
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3"><div className="flex items-center space-x-2"><Info className="w-4 h-4 text-purple-600" /><p className="text-xs text-purple-700">Product stays active for the selected duration.</p></div></div>
                <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Duration:</span><span className="font-medium text-gray-900">{DURATION_OPTIONS.find((d) => d.value === formData.durationTime)?.label || "Not set"}</span></div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 mb-4"><Info className="w-4 h-4 text-yellow-500" /><h3 className="font-semibold text-gray-900 text-sm">Product Summary</h3></div>
              <div className="space-y-2 text-sm">
                <SummaryRow label="Product ID">#{productId}</SummaryRow>
                <SummaryRow label="Name">{formData.name || "Not set"}</SummaryRow>
                <SummaryRow label="Prices">{priceRows.some((r) => Number(r.amount) > 0) ? <span className="flex flex-col items-end">{priceRows.filter((r) => Number(r.amount) > 0).map((r) => <span key={r.id}>{formatMoney(Number(r.amount), r.currency)}</span>)}</span> : "Not set"}</SummaryRow>
                <SummaryRow label="Discount">{priceRows.some((r) => r.discountAmount.trim() !== "" && Number(r.discountAmount) > 0) ? <span className="flex flex-col items-end">{priceRows.filter((r) => r.discountAmount.trim() !== "" && Number(r.discountAmount) > 0).map((r) => { const original = Number(r.amount); const discount = Number(r.discountAmount); const saving = original - discount; return <span key={r.id}>{formatMoney(discount, r.currency)} (save {formatMoney(saving, r.currency)})</span>; })}</span> : "Not set"}</SummaryRow>
                <SummaryRow label="Category">{categories.find((c) => c.id === formData.categoryId)?.name || "Not set"}</SummaryRow>
                <SummaryRow label="Subcategory">{subCategories.find((c) => c.id === formData.subCategoryId)?.name || "Not set"}</SummaryRow>
                <SummaryRow label="Weight">{formData.weight ? `${formData.weight} ${formData.unitOfMeasurement}` : "Not set"}</SummaryRow>
                <SummaryRow label="Images">{formData.images.length}</SummaryRow>
                <SummaryRow label="Video" last>{previewVideo ? "Added" : "None"}</SummaryRow>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditProductPage;