"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  LoaderCircle,
  MapPin,
  Navigation,
  ShieldAlert,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { api, uploadApi } from "@/lib/api";
import { CartItem, readCart, writeCart } from "@/app/lib/cart";

interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  note: string;
}

interface GpsFix {
  lat: number;
  lng: number;
  accuracy: number;
}

interface GeoAddress {
  city: string;
  subCity: string;
  street: string;
  display: string;
}

const MAX_GPS_ACCURACY_M = 500;

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);

function responseError(error: unknown): string {
  const message = (
    error as { response?: { data?: { error?: string } } }
  )?.response?.data?.error;
  return message || "We could not place your order. Please try again.";
}

export default function CheckoutPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [form, setForm] = useState<CheckoutForm>({
    customerName: "",
    customerPhone: "",
    shippingAddress: "",
    note: "",
  });
  const [loadingCart, setLoadingCart] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentProofName, setPaymentProofName] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentProofError, setPaymentProofError] = useState("");

  // ── Post-order payment verification (shown on this page) ──
  const [placedOrderNumber, setPlacedOrderNumber] = useState("");
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [shotVerify, setShotVerify] = useState<{
    status: "idle" | "loading" | "done" | "error";
    message: string;
    amount: number | null;
    ref: string | null;
    duplicateOf: string | null;
  }>({ status: "idle", message: "", amount: null, ref: null, duplicateOf: null });

  // ── Admin verification escalation (inline chat) ──
  const [verifyTicket, setVerifyTicket] = useState<{
    id: string;
    status: string;
    messages: { id: string; senderRole: string; body: string; createdAt: string }[];
  } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [requestingAdmin, setRequestingAdmin] = useState(false);

  // ── Nearest admin-posted delivery location ──
  const [nearestLocation, setNearestLocation] = useState<{
    id: string;
    name: string;
    country: string | null;
    region: string | null;
    woreda: string | null;
    kebele: string | null;
    landmark: string | null;
    latitude: number | null;
    longitude: number | null;
    fee: number;
    distanceKm: number | null;
  } | null>(null);

  // ── Verified GPS location ──
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [geo, setGeo] = useState<GeoAddress | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryQuote, setDeliveryQuote] = useState<{ fee: number; distanceKm: number | null } | null>(null);

  // ── Admin-managed delivery regions (fallback when GPS unavailable) ──
  interface DeliveryRegion {
    id: string;
    name: string;
    country: string | null;
    fee: number;
  }
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");

  useEffect(() => {
    api
      .get("/api/delivery-regions")
      .then((res) => {
        if (res.data?.success) setRegions(res.data.regions || []);
      })
      .catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      const t = window.setTimeout(() => router.replace("/auth/signin"), 0);
      return () => window.clearTimeout(t);
    } else if (status === "authenticated" && user) {
      const timer = window.setTimeout(() => {
        setForm((current) => ({
          ...current,
          customerName: user.name || current.customerName,
          customerPhone: user.phone || current.customerPhone,
          shippingAddress: user.address || current.shippingAddress,
        }));
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [status, user, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readCart());
      setLoadingCart(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) || null;

  // Delivery fee mirrors server logic: verified GPS quote wins, otherwise the
  // selected region's flat fee. Server recomputes authoritatively on submit.
  const deliveryFee = gps
    ? deliveryQuote?.fee ?? 0
    : selectedRegion?.fee ?? 0;
  const grandTotal = total + deliveryFee;

  const updateCart = (nextItems: CartItem[]) => {
    setItems(nextItems);
    writeCart(nextItems);
  };

  const setQuantity = (productId: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return;
    updateCart(
      items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const verifyScreenshot = async (file: File) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      setShotVerify({
        status: "error",
        message: "Choose a JPG, PNG, WEBP, AVIF, or PDF screenshot.",
        amount: null,
        ref: null,
        duplicateOf: null,
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setShotVerify({
        status: "error",
        message: "The screenshot must be 10 MB or smaller.",
        amount: null,
        ref: null,
        duplicateOf: null,
      });
      return;
    }

    setShotVerify({ status: "loading", message: "Reading screenshot…", amount: null, ref: null, duplicateOf: null });
    try {
      const data = new FormData();
      data.append("screenshot", file);
      const res = await api.post("/api/payments/verify-screenshot", data, {
        timeout: 120000,
        transformRequest: [
          (payload: FormData, headers: Record<string, unknown>) => {
            if (headers && typeof headers === "object") {
              delete headers["Content-Type"];
              delete headers["content-type"];
            }
            return payload;
          },
        ],
      });
      const d = res.data || {};
      // The verified screenshot doubles as the required payment proof
      if (d.url) {
        setPaymentProofUrl(d.url);
        setPaymentProofName(d.fileName || file.name);
        setPaymentProofFile(file);
        setPaymentProofError("");
      }
      if (d.transactionRef) setTransactionRef(d.transactionRef);
      setShotVerify({
        status: "done",
        message: d.message || "Screenshot verified.",
        amount: d.extractedAmount ?? null,
        ref: d.transactionRef ?? null,
        duplicateOf: d.duplicateOf ?? null,
      });
    } catch (err) {
      const ax = err as { response?: { data?: { error?: string } } };
      setShotVerify({
        status: "error",
        message:
          ax.response?.data?.error ||
          "Could not verify the screenshot. Try again or upload below.",
        amount: null,
        ref: null,
        duplicateOf: null,
      });
    }
  };

  const uploadPaymentProof = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPaymentProofUrl("");
    setPaymentProofName("");
    setPaymentProofFile(null);
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      setPaymentProofError("Choose a JPG, PNG, WEBP, AVIF, or PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPaymentProofError("The file must be 10 MB or smaller.");
      return;
    }

    setPaymentProofName(file.name);
    setPaymentProofFile(file);
    setPaymentProofUrl("");
    setPaymentProofError("");
    setUploadingProof(true);
    try {
      const response = await uploadApi.uploadPaymentProof(file);
      if (!response.success || !response.url) {
        throw new Error("The payment information file could not be uploaded.");
      }
      setPaymentProofUrl(response.url);
    } catch (uploadError) {
      console.error("Could not upload payment information:", uploadError);
      setPaymentProofName("");
      setPaymentProofFile(null);
      setPaymentProofError(
        "The file could not be uploaded. Please try again."
      );
    } finally {
      setUploadingProof(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<GeoAddress | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const a = data?.address || {};
      const city =
        a.city || a.town || a.village || a.municipality || a.county || "";
      const subCity =
        a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
      const street =
        [a.road || a.pedestrian || a.footway, a.house_number]
          .filter(Boolean)
          .join(" ") ||
        a.hamlet ||
        "";
      const display = [street, subCity, city].filter(Boolean).join(", ");
      return { city, subCity, street, display };
    } catch {
      return null;
    }
  };

  const detectLocation = () => {
    setGpsError("");
    setGeo(null);
    setDeliveryQuote(null);
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by this browser.");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(accuracy) || accuracy > MAX_GPS_ACCURACY_M) {
          setGpsLoading(false);
          setGps(null);
          setGpsError(
            `GPS accuracy is low (±${Math.round(accuracy || 0)}m). You can still order by selecting your delivery region below.`
          );
          return;
        }
        const fix: GpsFix = { lat: latitude, lng: longitude, accuracy };
        setGps(fix);
        const address = await reverseGeocode(latitude, longitude);
        setGeo(address);
        setGpsLoading(false);
        // Fetch backend delivery quote (fee computed server-side)
        try {
          const q = await api.get("/api/orders/delivery-quote", {
            params: { lat: latitude, lng: longitude, subtotal: total },
          });
          if (q.data?.success) {
            setDeliveryQuote({ fee: q.data.fee ?? 0, distanceKm: q.data.distanceKm ?? null });
          }
        } catch {
          /* quote is optional */
        }
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access and try again."
            : "Could not detect your location. Please check GPS/location services and try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Fetch nearest admin-posted delivery location whenever GPS locks
  useEffect(() => {
    if (!gps) {
      const timer = setTimeout(() => setNearestLocation(null), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    api
      .get("/api/delivery-regions/nearest", {
        params: { lat: gps.lat, lng: gps.lng },
      })
      .then((res) => {
        if (!cancelled && res.data?.success) {
          setNearestLocation(res.data.nearest || null);
        }
      })
      .catch(() => {
        if (!cancelled) setNearestLocation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gps]);

  // Poll verification-request messages while a ticket is open
  const verifyTicketId = verifyTicket?.id;
  const verifyTicketStatus = verifyTicket?.status;
  useEffect(() => {
    if (!verifyTicketId || verifyTicketStatus !== "PENDING") return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get(
          `/api/payments/verification-requests/${verifyTicketId}`
        );
        if (res.data?.success) setVerifyTicket(res.data.request);
      } catch {
        /* ignore poll errors */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [verifyTicketId, verifyTicketStatus]);

  const sendChat = async () => {
    if (!verifyTicket || !chatInput.trim() || chatSending) return;
    setChatSending(true);
    try {
      await api.post(
        `/api/payments/verification-requests/${verifyTicket.id}/messages`,
        { body: chatInput.trim() }
      );
      setChatInput("");
      const res = await api.get(
        `/api/payments/verification-requests/${verifyTicket.id}`
      );
      if (res.data?.success) setVerifyTicket(res.data.request);
    } catch {
      /* ignore */
    } finally {
      setChatSending(false);
    }
  };

  // Re-fetch the GPS delivery quote whenever the subtotal changes so the
  // displayed fee (incl. free-delivery thresholds) stays accurate.
  useEffect(() => {
    if (!gps) return;
    let cancelled = false;
    api
      .get("/api/orders/delivery-quote", {
        params: { lat: gps.lat, lng: gps.lng, subtotal: total },
      })
      .then((q) => {
        if (cancelled || !q.data?.success) return;
        setDeliveryQuote({ fee: q.data.fee ?? 0, distanceKm: q.data.distanceKm ?? null });
      })
      .catch(() => {
        if (!cancelled) setDeliveryQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gps, total]);

  const composedAddress = useMemo(() => {
    const parts = [
      geo?.display || "",
      selectedRegion ? `Region: ${selectedRegion.name}` : "",
      landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
    if (gps) return `GPS location: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
    return form.shippingAddress;
  }, [geo, selectedRegion, landmark, form.shippingAddress, gps]);

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (items.length === 0) {
      setError("Your order is empty. Add a product before checking out.");
      return;
    }
    if (!gps && !selectedRegionId) {
      setError("Please detect your exact location or select a delivery region before placing the order.");
      return;
    }
    if (uploadingProof || (paymentProofName && !paymentProofUrl)) {
      setError("Wait for the payment information file to finish uploading.");
      return;
    }
    if (!paymentProofUrl) {
      setError("Upload your payment information file before placing the order.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post("/api/orders", {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        shippingAddress: composedAddress,
        note: form.note,
        paymentMethod: "CASH_ON_DELIVERY",
        paymentProofUrl: paymentProofUrl || undefined,
        transactionRef: transactionRef.trim() || undefined,
        customerLat: gps?.lat ?? null,
        customerLng: gps?.lng ?? null,
        gpsAccuracy: gps?.accuracy ?? null,
        geoAddress: geo?.display || null,
        landmark: landmark.trim() || null,
        deliveryRegionId: selectedRegionId || null,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      });
      const order = response.data.order as { orderNumber?: string };
      updateCart([]);

      // Run payment verification and show the real result right here.
      // Priority: explicit transaction reference → provider API check;
      // otherwise OCR-verify the uploaded screenshot.
      const ref = transactionRef.trim();
      if ((ref || paymentProofFile) && order?.orderNumber) {
        setVerifying(true);
        try {
          if (ref) {
            const verifyResponse = await api.post("/api/payments/verify", {
              orderNumber: order.orderNumber,
              transactionRef: ref,
            });
            setVerifyResult(verifyResponse.data);
          } else if (paymentProofFile) {
            const verifyData = new FormData();
            verifyData.append("screenshot", paymentProofFile);
            const verifyResponse = await api.post(
              `/api/orders/${encodeURIComponent(order.orderNumber)}/verify-payment`,
              verifyData,
              {
                timeout: 120000,
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
            setVerifyResult(verifyResponse.data);
          }
        } catch (verifyError) {
          const data = (
            verifyError as { response?: { data?: Record<string, unknown> } }
          )?.response?.data;
          setVerifyResult(
            data || { success: false, verified: false, error: "Payment verification failed." }
          );
        } finally {
          setVerifying(false);
        }
        setPlacedOrderNumber(order.orderNumber);
        setSubmitting(false);
        return;
      }

      router.push(
        order?.orderNumber
          ? `/orders/${encodeURIComponent(order.orderNumber)}`
          : "/orders"
      );
    } catch (requestError) {
      setError(responseError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loadingCart) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[var(--cream)]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </main>
    );
  }

  if (status === "unauthenticated") return null;

  // ── Order placed + payment verification result ──
  if (placedOrderNumber) {
    const result = (verifyResult || {}) as {
      success?: boolean;
      verified?: boolean;
      paymentStatus?: string;
      comparison?: {
        status?: string;
        expected?: number;
        paid?: number | null;
        shortfall?: number | null;
        extra?: number | null;
      };
      transactionRef?: string | null;
      message?: string;
      error?: string;
      errorAm?: string;
      canEscalate?: boolean;
      reason?: string;
    };
    const cmp = result.comparison;
    const ok = result.success === true || result.verified === true;

    return (
      <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
        <div className="mx-auto max-w-xl">
          <section className="rounded-2xl border border-[#f0e8d8] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              {ok ? (
                <BadgeCheck className="h-9 w-9 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-9 w-9 text-amber-600" />
              )}
              <div>
                <h1 className="text-xl font-bold text-[#20283a]">
                  Order {placedOrderNumber} placed
                </h1>
                <p className="text-sm text-slate-500">
                  {verifying
                    ? "Verifying your payment receipt…"
                    : ok
                    ? "Payment verification complete."
                    : "Payment verification finished — review below."}
                </p>
              </div>
            </div>

            {verifying && (
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <LoaderCircle className="h-5 w-5 animate-spin text-[#EB6D3D]" />
                Reading your receipt with OCR — this can take up to a minute on first use…
              </div>
            )}

            {!verifying && verifyResult && (
              <div
                className={`mt-6 rounded-xl border p-4 text-sm ${
                  ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="font-bold">
                  {result.paymentStatus?.replaceAll("_", " ") ||
                    cmp?.status?.replaceAll("_", " ") ||
                    "UNVERIFIED"}
                </p>
                {cmp && (
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Order total</dt>
                      <dd className="font-semibold">
                        {cmp.expected != null ? money(cmp.expected) : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Amount detected</dt>
                      <dd className="font-semibold">
                        {cmp.paid != null ? money(cmp.paid) : "Could not read"}
                      </dd>
                    </div>
                    {cmp.shortfall != null && cmp.shortfall > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Shortfall</dt>
                        <dd className="font-semibold text-red-700">
                          {money(cmp.shortfall)}
                        </dd>
                      </div>
                    )}
                    {cmp.extra != null && cmp.extra > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Extra paid</dt>
                        <dd className="font-semibold">{money(cmp.extra)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {result.transactionRef && (
                  <p className="mt-2 text-xs">
                    Transaction ref:{" "}
                    <span className="font-mono font-semibold">
                      {result.transactionRef}
                    </span>
                  </p>
                )}
                <p className="mt-2 font-semibold">
                  {result.message || result.error || result.errorAm}
                </p>
                {result.paymentStatus === "PENDING_ADMIN_REVIEW" && (
                  <p className="mt-1 text-xs opacity-80">
                    Your receipt was flagged for admin review — no action needed.
                  </p>
                )}
              </div>
            )}

            {/* ── Admin escalation + inline chat ── */}
            {!verifying && !ok && (
              <div className="mt-4">
                {!verifyTicket ? (
                  <button
                    type="button"
                    disabled={requestingAdmin}
                    onClick={async () => {
                      setRequestingAdmin(true);
                      try {
                        const res = await api.post(
                          "/api/payments/verification-requests",
                          {
                            orderNumber: placedOrderNumber,
                            transactionRef:
                              transactionRef.trim() ||
                              (result.transactionRef as string) ||
                              "",
                            receiptUrl: paymentProofUrl || undefined,
                          }
                        );
                        if (res.data?.success) {
                          const ticketRes = await api.get(
                            `/api/payments/verification-requests/${res.data.request.id}`
                          );
                          setVerifyTicket(ticketRes.data.request);
                        }
                      } catch {
                        // surfaced via chat absence; user can retry
                      } finally {
                        setRequestingAdmin(false);
                      }
                    }}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    {requestingAdmin && (
                      <LoaderCircle size={15} className="animate-spin" />
                    )}
                    Request Admin Verification / Chat with Admin
                  </button>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Admin verification chat</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          verifyTicket.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : verifyTicket.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {verifyTicket.status}
                      </span>
                    </p>
                    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                      {verifyTicket.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-lg px-3 py-2 text-xs ${
                            m.senderRole === "ADMIN" || m.senderRole === "SYSTEM"
                              ? "bg-white border border-slate-200 text-slate-700"
                              : "bg-[#EB6D3D]/15 text-slate-800 ml-6"
                          }`}
                        >
                          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {m.senderRole === "USER" ? "You" : m.senderRole === "ADMIN" ? "Admin" : "System"}
                          </p>
                          {m.body}
                        </div>
                      ))}
                    </div>
                    {verifyTicket.status === "PENDING" ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !chatSending) {
                              e.preventDefault();
                              void sendChat();
                            }
                          }}
                          placeholder="Type a message to admin…"
                          maxLength={2000}
                          className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-[#EB6D3D]"
                        />
                        <button
                          type="button"
                          disabled={chatSending || !chatInput.trim()}
                          onClick={() => void sendChat()}
                          className="h-9 rounded-lg bg-[#1d4ed8] px-3 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {chatSending ? "…" : "Send"}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        {verifyTicket.status === "APPROVED"
                          ? "Payment approved — your order is PAID."
                          : "This request was closed by admin."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/orders/${encodeURIComponent(placedOrderNumber)}`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white"
              >
                View order details
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Continue shopping
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#cf5427] hover:text-[#20283a]"
        >
          <ArrowLeft size={16} /> Continue shopping
        </Link>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cf5427]">
            Secure checkout
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#20283a]">Your order</h1>
        </header>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {items.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-lg font-bold text-slate-800">
              Your order is empty
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Browse products and add the items you want to order.
            </p>
            <Link
              href="/shop"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] hover:bg-[#cf5427] hover:text-white"
            >
              Browse products
            </Link>
          </section>
        ) : (
          <form
            onSubmit={placeOrder}
            className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"
          >
            <section className="rounded-2xl border border-[#f0e8d8] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-bold text-[#20283a]">
                Payment information
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Email address
                  <input
                    type="email"
                    value={user?.email || ""}
                    readOnly
                    aria-readonly="true"
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-normal text-slate-600 outline-none"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Full name
                  <input
                    required
                    maxLength={160}
                    value={form.customerName}
                    onChange={(event) =>
                      setForm({ ...form, customerName: event.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-[#EB6D3D]"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Phone number
                  <input
                    required
                    maxLength={40}
                    type="tel"
                    value={form.customerPhone}
                    onChange={(event) =>
                      setForm({ ...form, customerPhone: event.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-[#EB6D3D]"
                  />
                </label>
                <div className="sm:col-span-2 rounded-xl border border-[#EB6D3D]/40 bg-[#EB6D3D]/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-[#20283a]">
                        <MapPin size={15} className="text-[#cf5427]" />
                        Delivery location <span className="text-red-600">*</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        We verify your GPS position to calculate the correct delivery fee.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={gpsLoading || submitting}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#cf5427] px-4 text-sm font-bold text-white transition hover:bg-[#9c3d1a] disabled:opacity-60"
                    >
                      {gpsLoading ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <Navigation size={15} />
                      )}
                      {gps ? "Re-detect location" : "Detect Exact Location"}
                    </button>
                  </div>

                  {/* Delivery region fallback — always available */}
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      Delivery region{" "}
                      {!gps && <span className="text-red-600">* required if GPS not detected</span>}
                      <select
                        value={selectedRegionId}
                        onChange={(event) => setSelectedRegionId(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal outline-none focus:border-[#EB6D3D]"
                      >
                        <option value="">Select your delivery area…</option>
                        {regions.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name}
                            {region.country ? ` (${region.country})` : ""}
                            {` — ${money(region.fee)}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedRegion && !gps && (
                      <p className="mt-1 text-xs font-semibold text-[#9c3d1a]">
                        Delivery fee for {selectedRegion.name}:{" "}
                        {money(selectedRegion.fee)}
                      </p>
                    )}
                  </div>

                  {gpsError && (
                    <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                      {gpsError}
                    </p>
                  )}

                  {gps && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700">
                        ✓ GPS locked — accuracy ±{Math.round(gps.accuracy)}m
                        {deliveryQuote?.distanceKm != null &&
                          ` · ${deliveryQuote.distanceKm} km from store`}
                        {deliveryQuote && ` · delivery fee ${money(deliveryQuote.fee)}`}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-slate-600">
                          City
                          <input
                            readOnly
                            value={geo?.city || "—"}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-600"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Sub-city / District
                          <input
                            readOnly
                            value={geo?.subCity || "—"}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-600"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          Street / Area
                          <input
                            readOnly
                            value={geo?.street || "—"}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-600"
                          />
                        </label>
                      </div>
                      <label className="block text-xs font-semibold text-slate-600">
                        Landmark / Building / Floor{" "}
                        <span className="font-normal text-slate-400">(optional)</span>
                        <input
                          maxLength={300}
                          value={landmark}
                          onChange={(event) => setLandmark(event.target.value)}
                          placeholder="e.g. Blue gate next to Abay Bank, 3rd floor"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm font-normal outline-none focus:border-[#EB6D3D]"
                        />
                      </label>
                    </div>
                  )}

                  {/* Nearest admin-posted delivery location */}
                  {nearestLocation && (
                    <div className="mt-3 rounded-xl border border-[#EB6D3D]/30 bg-[#EB6D3D]/5 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-[#9c3d1a]">
                        <MapPin size={13} />
                        Nearest delivery point
                        {nearestLocation.distanceKm != null &&
                          ` — ${nearestLocation.distanceKm} km away`}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {nearestLocation.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {[
                          nearestLocation.country,
                          nearestLocation.region,
                          nearestLocation.woreda,
                          nearestLocation.kebele,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "Location on file"}
                        {nearestLocation.landmark
                          ? ` — ${nearestLocation.landmark}`
                          : ""}
                      </p>
                      {nearestLocation.fee != null && (
                        <p className="mt-1 text-xs font-semibold text-[#9c3d1a]">
                          Delivery fee there: {money(Number(nearestLocation.fee))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Order note <span className="font-normal text-slate-400">(optional)</span>
                  <textarea
                    maxLength={4000}
                    rows={2}
                    value={form.note}
                    onChange={(event) =>
                      setForm({ ...form, note: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#EB6D3D]"
                  />
                </label>
              </div>

              <fieldset className="mt-5 border-t border-slate-100 pt-4">
                <legend className="text-lg font-bold text-[#20283a]">
                  Payment method
                </legend>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#EB6D3D]/50 bg-[#EB6D3D]/5 p-4">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH_ON_DELIVERY"
                    checked
                    readOnly
                    className="mt-1 accent-[#cf5427]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#20283a]">
                      Cash on delivery
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">
                      Pay the delivery agent when your order arrives. No online
                      payment is collected at checkout.
                    </span>
                  </span>
                </label>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    Verify payment screenshot{" "}
                    <span className="font-normal text-slate-400">
                      (upload your receipt — we read the amount &amp; reference)
                    </span>
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                    disabled={shotVerify.status === "loading" || submitting}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void verifyScreenshot(file);
                    }}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-[#1d4ed8]/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#1d4ed8] disabled:opacity-60"
                  />
                  {shotVerify.status === "loading" && (
                    <span className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {shotVerify.message}
                    </span>
                  )}
                  {shotVerify.status === "done" && (
                    <div
                      className={`mt-2 rounded-lg border p-2.5 text-xs ${
                        shotVerify.duplicateOf
                          ? "border-red-200 bg-red-50 text-red-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <p className="font-semibold">{shotVerify.message}</p>
                      {(shotVerify.amount != null || shotVerify.ref) && (
                        <p className="mt-1">
                          {shotVerify.amount != null && (
                            <>Amount read: <strong>ETB {shotVerify.amount.toFixed(2)}</strong></>
                          )}
                          {shotVerify.ref && (
                            <>
                              {shotVerify.amount != null && " · "}
                              Ref: <span className="font-mono">{shotVerify.ref}</span>
                            </>
                          )}
                        </p>
                      )}
                      {shotVerify.duplicateOf && (
                        <p className="mt-1 font-semibold">
                          This receipt was already used for order {shotVerify.duplicateOf}.
                        </p>
                      )}
                    </div>
                  )}
                  {shotVerify.status === "error" && (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">
                      {shotVerify.message}
                    </p>
                  )}
                </div>
                <label className="mt-4 block text-sm font-semibold text-slate-700">
                  Upload payment information or receipt{" "}
                  <span className="text-red-600">(required)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                    onChange={uploadPaymentProof}
                    disabled={uploadingProof || submitting}
                    aria-required="true"
                    className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-[#EB6D3D]/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#20283a] disabled:opacity-60"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Required to place your order. JPG, PNG, WEBP, AVIF, or PDF; maximum file size 10 MB.
                  </span>
                  {uploadingProof && (
                    <span className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Uploading {paymentProofName}...
                    </span>
                  )}
                  {paymentProofUrl && (
                    <span className="mt-2 flex items-center justify-between gap-3 text-xs text-green-700">
                      <span className="truncate">
                        Uploaded: {paymentProofName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentProofUrl("");
                          setPaymentProofName("");
                          setPaymentProofFile(null);
                          setPaymentProofError("");
                        }}
                        className="shrink-0 font-semibold underline"
                      >
                        Remove
                      </button>
                    </span>
                  )}
                  {paymentProofError && (
                    <span role="alert" className="mt-2 block text-xs text-red-600">
                      {paymentProofError}
                    </span>
                  )}
                </label>
              </fieldset>
            </section>

            <aside className="h-fit rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[#20283a]">Order summary</h2>
              <ul className="mt-4 divide-y divide-slate-100">
                {items.map((item) => (
                  <li
                    key={item.productId}
                    className="flex gap-3 py-4 first:pt-0"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          unoptimized
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {money(item.unitPrice)} each
                      </p>
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
                        Qty
                        <input
                          aria-label={`Quantity for ${item.name}`}
                          type="number"
                          min={1}
                          max={999}
                          value={item.quantity}
                          onChange={(event) =>
                            setQuantity(item.productId, Number(event.target.value))
                          }
                          className="h-8 w-16 rounded border border-slate-300 px-2"
                        />
                      </label>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <strong className="text-sm text-slate-800">
                        {money(item.unitPrice * item.quantity)}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          updateCart(
                            items.filter(
                              (cartItem) =>
                                cartItem.productId !== item.productId
                            )
                          )
                        }
                        aria-label={`Remove ${item.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-4 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{money(total)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    Delivery fee
                    {gps && deliveryQuote?.distanceKm != null
                      ? ` (${deliveryQuote.distanceKm} km)`
                      : selectedRegion
                      ? ` (${selectedRegion.name})`
                      : ""}
                  </span>
                  <span>
                    {gps && !deliveryQuote ? "…" : money(deliveryFee)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-[#20283a]">
                  <span>Total</span>
                  <span>{money(grandTotal)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Final prices and available stock are verified when you place
                the order.
              </p>
              <button
                type="submit"
                disabled={submitting || uploadingProof || items.length === 0 || (!gps && !selectedRegionId)}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#cf5427] px-5 text-base font-extrabold text-white shadow-lg shadow-[#cf5427]/25 transition hover:bg-[#9c3d1a] hover:shadow-xl hover:shadow-[#cf5427]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {submitting ? "Placing order..." : "Place order"}
              </button>
            </aside>
          </form>
        )}
      </div>
    </main>
  );
}
