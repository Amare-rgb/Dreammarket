"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, LoaderCircle, MapPin, Navigation, ShieldAlert, ShoppingBag, Trash2 } from "lucide-react";
import { useAuth } from "@/app/providers";
import { api, uploadApi } from "@/lib/api";
import { CartItem, readCart, writeCart } from "@/app/lib/cart";

interface CheckoutForm { customerName: string; customerPhone: string; shippingAddress: string; note: string; }
interface GpsFix { lat: number; lng: number; accuracy: number; }
interface GeoAddress { display: string; }
interface DeliveryRegion { id: string; name: string; country: string | null; fee: number; }
interface NearestHub { id: string; name: string; distanceKm: number | null; }
interface VerifyTicket { id: string; status: string; messages: { id: string; senderRole: string; body: string; createdAt: string }[]; }
interface VerifyResult {
  success?: boolean;
  verified?: boolean;
  paymentStatus?: string;
  comparison?: { status?: string; expected?: number; paid?: number | null; shortfall?: number | null; extra?: number | null };
  transactionRef?: string | null;
  message?: string;
  error?: string;
  errorAm?: string;
}

const MAX_GPS_ACCURACY_M = 500;
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"]);
const INPUT_CLS = "h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-[#EB6D3D]";
const MULTIPART_OPTS = {
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
};

const money = (n: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(n);

const getApiError = (err: unknown) =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  "We could not place your order. Please try again.";

function checkProofFile(file: File): string | null {
  if (!ALLOWED_PROOF_TYPES.has(file.type)) return "Choose a JPG, PNG, WEBP, AVIF, or PDF file.";
  if (file.size > MAX_PROOF_BYTES) return "The file must be 10 MB or smaller.";
  return null;
}

export default function CheckoutPage() {
  const { user, status } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<CartItem[]>([]);
  const [form, setForm] = useState<CheckoutForm>({ customerName: "", customerPhone: "", shippingAddress: "", note: "" });
  const [loadingCart, setLoadingCart] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [proofUrl, setProofUrl] = useState("");
  const [proofName, setProofName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState("");
  const [transactionRef, setTransactionRef] = useState("");

  const [placedOrder, setPlacedOrder] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [shotMsg, setShotMsg] = useState<{ text: string; isError: boolean; amount?: number | null } | null>(null);

  const [ticket, setTicket] = useState<VerifyTicket | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [requestingAdmin, setRequestingAdmin] = useState(false);

  const [gps, setGps] = useState<GpsFix | null>(null);
  const [geo, setGeo] = useState<GeoAddress | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [landmark, setLandmark] = useState("");
  const [quote, setQuote] = useState<{ fee: number; distanceKm: number | null } | null>(null);
  const [nearestHub, setNearestHub] = useState<NearestHub | null>(null);
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [regionId, setRegionId] = useState("");

  const total = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items]);
  const region = regions.find((r) => r.id === regionId) || null;
  const deliveryFee = gps ? quote?.fee ?? 0 : region?.fee ?? 0;
  const grandTotal = total + deliveryFee;

  const composedAddress = useMemo(() => {
    const parts = [
      geo?.display || "",
      region ? `Region: ${region.name}` : "",
      landmark.trim() ? `Landmark: ${landmark.trim()}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" — ");
    if (gps) return `GPS location: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
    return form.shippingAddress;
  }, [geo, region, landmark, form.shippingAddress, gps]);

  useEffect(() => {
    api.get("/api/delivery-regions").then((r) => r.data?.success && setRegions(r.data.regions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      const id = window.setTimeout(() => router.replace("/auth/signin"), 0);
      return () => window.clearTimeout(id);
    }
    if (status === "authenticated" && user) {
      const id = window.setTimeout(() => {
        setForm((cur) => ({
          ...cur,
          customerName: user.name || cur.customerName,
          customerPhone: user.phone || cur.customerPhone,
          shippingAddress: user.address || cur.shippingAddress,
        }));
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [status, user, router]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setItems(readCart());
      setLoadingCart(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!gps) {
      const id = setTimeout(() => {
        setNearestHub(null);
        setQuote(null);
      }, 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    api.get("/api/delivery-regions/nearest", { params: { lat: gps.lat, lng: gps.lng } })
      .then((r) => !cancelled && r.data?.success && setNearestHub(r.data.nearest || null))
      .catch(() => !cancelled && setNearestHub(null));
    api.get("/api/orders/delivery-quote", { params: { lat: gps.lat, lng: gps.lng, subtotal: total } })
      .then((r) => !cancelled && r.data?.success && setQuote({ fee: r.data.fee ?? 0, distanceKm: r.data.distanceKm ?? null }))
      .catch(() => !cancelled && setQuote(null));
    return () => { cancelled = true; };
  }, [gps, total]);

  const refreshTicket = useCallback(async (ticketId: string) => {
    const res = await api.get(`/api/payments/verification-requests/${ticketId}`);
    if (res.data?.success) setTicket(res.data.request);
  }, []);

  useEffect(() => {
    if (!ticket?.id || ticket.status !== "PENDING") return;
    const timer = setInterval(() => void refreshTicket(ticket.id).catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [ticket?.id, ticket?.status, refreshTicket]);

  const setCart = (next: CartItem[]) => {
    setItems(next);
    writeCart(next);
  };

  const setQty = (productId: string, quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return;
    setCart(items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setProofUrl("");
    setProofName("");
    setProofFile(null);
    setProofError("");
    setShotMsg(null);

    const errMsg = checkProofFile(file);
    if (errMsg) return setProofError(errMsg);

    setProofName(file.name);
    setProofFile(file);
    setUploadingProof(true);

    try {
      const uploaded = await uploadApi.uploadPaymentProof(file);
      if (!uploaded.success || !uploaded.url) throw new Error("Upload failed");
      setProofUrl(uploaded.url);

      const shotPayload = new FormData();
      shotPayload.append("screenshot", file);
      const { data } = await api.post("/api/payments/verify-screenshot", shotPayload, MULTIPART_OPTS);
      if (data?.transactionRef) setTransactionRef(data.transactionRef);
      setShotMsg({ text: data?.message || "Screenshot verified.", isError: false, amount: data?.extractedAmount ?? null });
    } catch {
      setProofError("Could not upload or verify the file. Please try again.");
      setShotMsg({ text: "Could not verify the screenshot.", isError: true });
    } finally {
      setUploadingProof(false);
    }
  };

  const detectLocation = () => {
    setGpsError("");
    setGeo(null);
    setQuote(null);
    if (!navigator.geolocation) return setGpsError("Geolocation is not supported by this browser.");

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude, accuracy } }) => {
        if (!Number.isFinite(accuracy) || accuracy > MAX_GPS_ACCURACY_M) {
          setGpsLoading(false);
          setGps(null);
          return setGpsError(`GPS accuracy is low (±${Math.round(accuracy || 0)}m). Select a delivery region below.`);
        }
        setGps({ lat: latitude, lng: longitude, accuracy });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          if (res.ok) {
            const a = (await res.json())?.address || {};
            const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(" ") || a.hamlet || "";
            const sub = a.suburb || a.neighbourhood || a.quarter || a.city_district || "";
            const city = a.city || a.town || a.village || a.municipality || a.county || "";
            setGeo({ display: [street, sub, city].filter(Boolean).join(", ") });
          }
        } catch { /* optional */ }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location access or choose a region."
            : "Could not detect your location. Check GPS settings or choose a region."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const verifyOrderPayment = async (orderNumber: string) => {
    const ref = transactionRef.trim();
    if (!ref && !proofFile) return false;
    setVerifying(true);
    try {
      if (ref) {
        const { data } = await api.post("/api/payments/verify", { orderNumber, transactionRef: ref });
        setVerifyResult(data);
      } else if (proofFile) {
        const body = new FormData();
        body.append("screenshot", proofFile);
        const { data } = await api.post(`/api/orders/${encodeURIComponent(orderNumber)}/verify-payment`, body, MULTIPART_OPTS);
        setVerifyResult(data);
      }
    } catch (err) {
      setVerifyResult(
        (err as { response?: { data?: VerifyResult } })?.response?.data || {
          success: false,
          verified: false,
          error: "Payment verification failed.",
        }
      );
    } finally {
      setVerifying(false);
      setPlacedOrder(orderNumber);
    }
    return true;
  };

  const placeOrder = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!items.length) return setError("Your order is empty. Add a product before checking out.");
    if (!gps && !regionId) return setError("Detect your exact location or select a delivery region.");
    if (uploadingProof || (proofName && !proofUrl)) return setError("Wait for the payment file to finish uploading.");
    if (!proofUrl) return setError("Upload your payment proof before placing the order.");

    setSubmitting(true);
    try {
      const res = await api.post("/api/orders", {
        ...form,
        shippingAddress: composedAddress,
        paymentMethod: "CASH_ON_DELIVERY",
        paymentProofUrl: proofUrl,
        transactionRef: transactionRef.trim() || undefined,
        customerLat: gps?.lat ?? null,
        customerLng: gps?.lng ?? null,
        gpsAccuracy: gps?.accuracy ?? null,
        geoAddress: geo?.display || null,
        landmark: landmark.trim() || null,
        deliveryRegionId: regionId || null,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      });
      const orderNumber = (res.data.order as { orderNumber?: string })?.orderNumber;
      setCart([]);
      if (orderNumber && (await verifyOrderPayment(orderNumber))) return;
      router.push(orderNumber ? `/orders/${encodeURIComponent(orderNumber)}` : "/orders");
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openAdminTicket = async () => {
    setRequestingAdmin(true);
    try {
      const res = await api.post("/api/payments/verification-requests", {
        orderNumber: placedOrder,
        transactionRef: transactionRef.trim() || verifyResult?.transactionRef || "",
        receiptUrl: proofUrl || undefined,
      });
      if (res.data?.success) await refreshTicket(res.data.request.id);
    } catch { /* retry */ } finally {
      setRequestingAdmin(false);
    }
  };

  const sendChat = async () => {
    if (!ticket || !chatInput.trim() || chatSending) return;
    setChatSending(true);
    try {
      await api.post(`/api/payments/verification-requests/${ticket.id}/messages`, { body: chatInput.trim() });
      setChatInput("");
      await refreshTicket(ticket.id);
    } catch { /* ignore */ } finally {
      setChatSending(false);
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

  if (placedOrder) {
    const cmp = verifyResult?.comparison;
    const ok = verifyResult?.success === true || verifyResult?.verified === true;
    return (
      <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#f0e8d8] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            {ok ? <BadgeCheck className="h-9 w-9 text-emerald-600" /> : <ShieldAlert className="h-9 w-9 text-amber-600" />}
            <div>
              <h1 className="text-xl font-bold text-[#20283a]">Order {placedOrder} placed</h1>
              <p className="text-sm text-slate-500">
                {verifying ? "Verifying payment receipt…" : ok ? "Payment verification complete." : "Review verification status below."}
              </p>
            </div>
          </div>

          {verifying && (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin text-[#EB6D3D]" /> Reading receipt with OCR…
            </div>
          )}

          {!verifying && verifyResult && (
            <div className={`mt-6 rounded-xl border p-4 text-sm ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-bold">{verifyResult.paymentStatus?.replaceAll("_", " ") || cmp?.status?.replaceAll("_", " ") || "UNVERIFIED"}</p>
              {cmp && (
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><dt className="text-slate-500">Order total</dt><dd className="font-semibold">{cmp.expected != null ? money(cmp.expected) : "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Amount detected</dt><dd className="font-semibold">{cmp.paid != null ? money(cmp.paid) : "Could not read"}</dd></div>
                  {cmp.shortfall != null && cmp.shortfall > 0 && (
                    <div className="flex justify-between"><dt className="text-slate-500">Shortfall</dt><dd className="font-semibold text-red-700">{money(cmp.shortfall)}</dd></div>
                  )}
                  {cmp.extra != null && cmp.extra > 0 && (
                    <div className="flex justify-between"><dt className="text-slate-500">Extra paid</dt><dd className="font-semibold">{money(cmp.extra)}</dd></div>
                  )}
                </dl>
              )}
              {verifyResult.transactionRef && (
                <p className="mt-2 text-xs">Transaction ref: <span className="font-mono font-semibold">{verifyResult.transactionRef}</span></p>
              )}
              <p className="mt-2 font-semibold">{verifyResult.message || verifyResult.error || verifyResult.errorAm}</p>
            </div>
          )}

          {!verifying && !ok && (
            <div className="mt-4">
              {!ticket ? (
                <button
                  type="button"
                  disabled={requestingAdmin}
                  onClick={() => void openAdminTicket()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  {requestingAdmin && <LoaderCircle size={15} className="animate-spin" />} Request Admin Verification / Chat
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Admin verification chat</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{ticket.status}</span>
                  </p>
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                    {ticket.messages.map((m) => (
                      <div key={m.id} className={`rounded-lg px-3 py-2 text-xs ${m.senderRole === "USER" ? "ml-6 bg-[#EB6D3D]/15 text-slate-800" : "border border-slate-200 bg-white text-slate-700"}`}>
                        <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">{m.senderRole === "USER" ? "You" : m.senderRole === "ADMIN" ? "Admin" : "System"}</p>
                        {m.body}
                      </div>
                    ))}
                  </div>
                  {ticket.status === "PENDING" && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !chatSending && (e.preventDefault(), void sendChat())}
                        placeholder="Type a message to admin…"
                        maxLength={2000}
                        className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-[#EB6D3D]"
                      />
                      <button type="button" disabled={chatSending || !chatInput.trim()} onClick={() => void sendChat()} className="h-9 rounded-lg bg-[#1d4ed8] px-3 text-xs font-bold text-white disabled:opacity-60">
                        {chatSending ? "…" : "Send"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/orders/${encodeURIComponent(placedOrder)}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] hover:bg-[#cf5427] hover:text-white">
              View order details
            </Link>
            <Link href="/shop" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Continue shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-[#cf5427] hover:text-[#20283a]">
          <ArrowLeft size={16} /> Continue shopping
        </Link>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cf5427]">Secure checkout</p>
          <h1 className="mt-1 text-3xl font-bold text-[#20283a]">Your order</h1>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {!items.length ? (
          <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-lg font-bold text-slate-800">Your order is empty</h2>
            <p className="mt-1 text-sm text-slate-500">Browse products and add the items you want to order.</p>
            <Link href="/shop" className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] hover:bg-[#cf5427] hover:text-white">
              Browse products
            </Link>
          </section>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
            <form onSubmit={placeOrder} className="space-y-6">
              <section className="rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-[#20283a]">Delivery details</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Full name</label>
                    <input required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Phone number</label>
                    <input required type="tel" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} className={INPUT_CLS} />
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Navigation size={14} className="text-[#EB6D3D]" /> Live GPS location
                    </span>
                    <button type="button" disabled={gpsLoading} onClick={detectLocation} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#20283a] px-3 text-xs font-bold text-white hover:bg-[#cf5427] disabled:opacity-60">
                      {gpsLoading && <LoaderCircle size={13} className="animate-spin" />} {gps ? "Refresh GPS" : "Detect my location"}
                    </button>
                  </div>
                  {gpsError && <p className="mt-2 text-xs text-red-600">{gpsError}</p>}
                  {gps && (
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p className="font-semibold text-emerald-700">GPS locked (±{Math.round(gps.accuracy)}m) — {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
                      {geo?.display && <p>Detected address: {geo.display}</p>}
                      {quote?.distanceKm != null && <p>Estimated distance: {quote.distanceKm.toFixed(1)} km</p>}
                      {nearestHub && <p className="flex items-center gap-1 text-slate-500"><MapPin size={12} /> Nearest hub: {nearestHub.name}{nearestHub.distanceKm != null ? ` (${nearestHub.distanceKm.toFixed(1)} km)` : ""}</p>}
                    </div>
                  )}
                </div>

                {regions.length > 0 && (
                  <div className="mt-4">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Delivery region</label>
                    <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className={`${INPUT_CLS} bg-white`}>
                      <option value="">Select delivery region</option>
                      {regions.map((r) => <option key={r.id} value={r.id}>{r.name} {r.country ? `(${r.country})` : ""} — {money(r.fee)}</option>)}
                    </select>
                  </div>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Landmark (optional)</label>
                    <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near main gate, bank, etc." className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Delivery address</label>
                    <input required={!gps && !regionId} value={composedAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} className={INPUT_CLS} />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Order note (optional)</label>
                  <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={INPUT_CLS} />
                </div>
              </section>

              <section className="rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-[#20283a]">Payment proof & verification</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Transaction reference (optional)</label>
                    <input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="e.g. FT26331..." className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Payment receipt / screenshot *</label>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.avif,.pdf" onChange={(e) => void handleFileChange(e)} className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#faf6ee] file:px-3 file:py-2 file:font-semibold file:text-[#20283a]" />
                  </div>
                </div>
                {uploadingProof && <p className="mt-2 text-xs text-slate-500">Uploading and verifying payment proof…</p>}
                {proofName && <p className="mt-2 text-xs font-medium text-slate-700">Selected: {proofName}</p>}
                {proofError && <p className="mt-2 text-xs text-red-600">{proofError}</p>}
                {shotMsg && (
                  <p className={`mt-2 text-xs font-semibold ${shotMsg.isError ? "text-red-600" : "text-emerald-700"}`}>
                    {shotMsg.text} {shotMsg.amount != null ? `(${money(shotMsg.amount)})` : ""}
                  </p>
                )}
                <button type="submit" disabled={submitting || uploadingProof} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EB6D3D] px-6 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:opacity-60">
                  {submitting && <LoaderCircle size={16} className="animate-spin" />}
                  {submitting ? "Placing order…" : `Place order — ${money(grandTotal)}`}
                </button>
              </section>
            </form>

            <aside className="h-fit rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[#20283a]">Order summary</h2>
              <ul className="mt-4 divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3 py-3 first:pt-0">
                    {item.image && <Image src={item.image} alt={item.name} width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{money(item.unitPrice)} each</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input type="number" min={1} max={999} value={item.quantity} onChange={(e) => setQty(item.productId, Number(e.target.value))} className="h-7 w-16 rounded border border-slate-200 px-2 text-xs" />
                        <button type="button" onClick={() => setCart(items.filter((i) => i.productId !== item.productId))} aria-label={`Remove ${item.name}`} className="text-slate-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{money(item.unitPrice * item.quantity)}</p>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-semibold text-slate-800">{money(total)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Delivery</dt><dd className="font-semibold text-slate-800">{money(deliveryFee)}</dd></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-[#20283a]"><dt>Total</dt><dd>{money(grandTotal)}</dd></div>
              </dl>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}