"use client";

import { useRef, useState } from "react";
import {
  BadgeCheck,
  FileImage,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { api } from "@/app/lib/api";
import { useLanguage } from "@/context/LanguageContext";

interface VerificationResult {
  success: boolean;
  paymentStatus?: string;
  comparison?: {
    status: string;
    expected: number;
    paid: number | null;
    difference?: number | null;
    shortfall?: number | null;
    extra?: number | null;
  };
  extractedAmount?: number | null;
  transactionRef?: string | null;
  message?: string;
  messageAm?: string;
  error?: string;
  errorAm?: string;
  code?: string;
}

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AMOUNT_MATCHED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING_ADMIN_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  AMOUNT_MISMATCH: "bg-orange-100 text-orange-800 border-orange-200",
  UNDERPAID: "bg-orange-100 text-orange-800 border-orange-200",
  OVERPAID: "bg-orange-100 text-orange-800 border-orange-200",
  DUPLICATE_RECEIPT: "bg-red-100 text-red-800 border-red-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  UNVERIFIED: "bg-slate-100 text-slate-600 border-slate-200",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(n);

interface Props {
  orderRef: string; // orderNumber or id
  currentStatus?: string | null;
  transactionRef?: string | null;
  verifiedAt?: string | null;
  onVerified?: () => void;
}

export default function PaymentVerification({
  orderRef,
  currentStatus,
  transactionRef,
  verifiedAt,
  onVerified,
}: Props) {
  const { language } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState("");

  const statusKey =
    result?.comparison?.status || result?.paymentStatus || currentStatus || "UNVERIFIED";

  const submit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("screenshot", file);
      const res = await api.post(
        `/api/orders/${encodeURIComponent(orderRef)}/verify-payment`,
        formData,
        {
          timeout: 120000, // OCR can take a while on first run
          transformRequest: [
            (data: FormData, headers: Record<string, unknown>) => {
              if (headers && typeof headers === "object") {
                delete headers["Content-Type"];
                delete headers["content-type"];
              }
              return data;
            },
          ],
        }
      );
      setResult(res.data as VerificationResult);
      if (res.data?.success) onVerified?.();
    } catch (err) {
      const ax = err as {
        response?: { data?: VerificationResult; status?: number };
      };
      const data = ax.response?.data;
      if (data) {
        setResult({ ...data, success: false });
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isAm = language === "am";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <ShieldCheck size={16} className="text-[#cf5427]" />
          {isAm ? "የክፍያ ማረጋገጫ" : "Payment verification"}
        </p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
            STATUS_STYLES[statusKey] || STATUS_STYLES.UNVERIFIED
          }`}
        >
          {(result?.comparison?.status || currentStatus || "UNVERIFIED").replaceAll("_", " ")}
        </span>
      </div>

      {/* Existing verified info */}
      {(transactionRef || verifiedAt) && !result && (
        <p className="mt-2 text-xs text-slate-500">
          {transactionRef && (
            <>
              Ref: <span className="font-mono font-semibold">{transactionRef}</span>
              {" · "}
            </>
          )}
          {verifiedAt &&
            new Date(verifiedAt).toLocaleString()}
        </p>
      )}

      {/* Upload */}
      <div className="mt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResult(null);
            setError("");
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-[#EB6D3D] hover:text-[#cf5427] disabled:opacity-60"
        >
          {file ? (
            <>
              <FileImage size={16} />
              <span className="max-w-[220px] truncate">{file.name}</span>
            </>
          ) : (
            <>
              <UploadCloud size={16} />
              {isAm
                ? "የክፍያ ማረጋገጫ ስክሪንሾት ይስቀሉ"
                : "Upload payment screenshot"}
            </>
          )}
        </button>

        {file && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1d4ed8] px-4 text-sm font-bold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
          >
            {submitting && <LoaderCircle size={15} className="animate-spin" />}
            {submitting
              ? isAm
                ? "በመረጋገጥ ላይ…"
                : "Verifying…"
              : isAm
              ? "አረጋግጥ"
              : "Verify payment"}
          </button>
        )}
      </div>

      {/* Result */}
      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}

      {result && (
        <div
          className={`mt-3 rounded-lg border p-3 text-xs ${
            result.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {!result.success && (
            <p className="flex items-center gap-1.5 font-bold">
              <ShieldAlert size={14} />
              {isAm ? result.errorAm || result.error : result.error}
            </p>
          )}
          {result.comparison && (
            <div className="mt-1 space-y-0.5">
              <p>
                <span className="font-semibold">
                  {isAm ? "የተጠበቀው መጠን" : "Expected"}:
                </span>{" "}
                {money(result.comparison.expected)}
                {" · "}
                <span className="font-semibold">
                  {isAm ? "የተከፈለው" : "Paid"}:
                </span>{" "}
                {result.comparison.paid != null
                  ? money(result.comparison.paid)
                  : "—"}
              </p>
              {result.comparison.shortfall != null && (
                <p>
                  {isAm ? "እጥረት" : "Shortfall"}:{" "}
                  {money(result.comparison.shortfall)}
                </p>
              )}
              {result.comparison.extra != null && (
                <p>
                  {isAm ? "ተጨማሪ" : "Extra"}:{" "}
                  {money(result.comparison.extra)}
                </p>
              )}
            </div>
          )}
          {result.transactionRef && (
            <p className="mt-1">
              {isAm ? "ሪፈረንስ" : "Reference"}:{" "}
              <span className="font-mono font-semibold">
                {result.transactionRef}
              </span>
            </p>
          )}
          <p className="mt-1 font-semibold">
            {isAm ? result.messageAm || result.message : result.message}
          </p>
          {result.paymentStatus === "PENDING_ADMIN_REVIEW" && (
            <p className="mt-1 opacity-80">
              {isAm
                ? "ደረሰኝዎ ለአስተዳዳሪ ግምገማ ተልኳል።"
                : "Your receipt has been flagged for admin review."}
            </p>
          )}
        </div>
      )}

      {currentStatus === "VERIFIED" && !result && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <BadgeCheck size={14} />
          {isAm ? "ክፍያው ተረጋግጧል" : "Payment verified"}
        </p>
      )}
    </div>
  );
}
