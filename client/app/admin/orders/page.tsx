"use client";

import { ButtonHTMLAttributes, ReactNode, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, Gift, LoaderCircle, MapPin, Send, ShoppingCart, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface OrderItem { id: string; productName: string; sku: string; quantity: number; unitPrice: number; image: string | null }

interface Order {
  id: string; orderNumber: string; customerName: string; customerEmail: string; customerPhone: string;
  shippingAddress: string; note: string | null; paymentMethod: string; paymentProofUrl: string | null;
  paymentScreenshotUrl?: string | null; paymentStatus?: string | null; transactionRef?: string | null;
  verificationMethod?: string | null; verificationNotes?: string | null; verifiedAt?: string | null;
  status: OrderStatus; total: number; createdAt: string; items: OrderItem[]; rewardQualified?: boolean;
  qualifiedRule?: {
    id: string; name: string; rewardType: string; rewardValue: string; currency?: string; payoutMethod?: string;
    promoCode: string | null; triggerType: string; threshold: number; scope: string;
  } | null;
  rewardDispatches?: { id: string; channel: string; status: string; sentAt: string | null; createdAt: string }[];
  deliveryFee?: number | null; deliveryDistanceKm?: number | null; deliveryMapsUrl?: string | null;
  customerLat?: number | null; customerLng?: number | null; gpsAccuracy?: number | null;
  geoAddress?: string | null; landmark?: string | null; deliveryVerified?: boolean;
  deliveryRegion?: { id: string; name: string; country: string | null; fee: number } | null;
}

type Notice = { type: "success" | "warning"; message: string } | null;

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(amount);

const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;

const paymentMethodLabel = (method: string) =>
  method.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");

const toneCls = {
  green: "bg-green-700 text-white hover:bg-green-800",
  blue: "bg-blue-600 text-white hover:bg-blue-700",
  indigo: "bg-indigo-600 text-white hover:bg-indigo-700",
  emerald: "bg-emerald-600 text-white hover:bg-emerald-700",
  amber: "bg-amber-600 text-white hover:bg-amber-700",
  red: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};
type Tone = keyof typeof toneCls;

// Next-step button (and optional cancel label) for each order status
const cancelLabel: [string, string] = ["orders.cancel", "Cancel"];
const statusFlow: Partial<Record<OrderStatus, { to: OrderStatus; key: string; label: string; tone: Tone; cancel?: [string, string] }>> = {
  PENDING: { to: "CONFIRMED", key: "orders.approve", label: "Approve", tone: "green", cancel: ["orders.reject", "Reject"] },
  CONFIRMED: { to: "PROCESSING", key: "orders.start_processing", label: "Start processing", tone: "blue", cancel: cancelLabel },
  PROCESSING: { to: "SHIPPED", key: "orders.mark_shipped", label: "Mark as shipped", tone: "indigo", cancel: cancelLabel },
  SHIPPED: { to: "DELIVERED", key: "orders.mark_delivered", label: "Mark as delivered", tone: "emerald" },
};

const statusBadge: Record<OrderStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-green-50 text-green-800",
  PROCESSING: "bg-blue-50 text-blue-800",
  SHIPPED: "bg-indigo-50 text-indigo-800",
  DELIVERED: "bg-emerald-50 text-emerald-800",
  CANCELLED: "bg-red-50 text-red-700",
};

const payBadgeCls = (status: string) =>
  status === "VERIFIED" ? "bg-emerald-100 text-emerald-800"
  : ["PENDING_ADMIN_REVIEW", "AMOUNT_MISMATCH", "DUPLICATE_RECEIPT"].includes(status) ? "bg-amber-100 text-amber-800"
  : status === "REJECTED" ? "bg-red-100 text-red-800"
  : "bg-slate-100 text-slate-600";

const boxTones = {
  blue: ["border-blue-200 bg-blue-50", "text-blue-800"],
  emerald: ["border-emerald-200 bg-emerald-50", "text-emerald-800"],
  amber: ["border-amber-200 bg-amber-50", "text-amber-800"],
  slate: ["border-slate-200 bg-white", "text-slate-500"],
};

const Spinner = () => <LoaderCircle className="h-3.5 w-3.5 animate-spin" />;

// Small action button; shows a spinner in place of the icon while busy
function Btn({ tone, busy, icon, small, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone: Tone; icon: ReactNode; busy?: boolean; small?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex ${small ? "h-8" : "h-9"} items-center gap-1.5 rounded-lg px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${toneCls[tone]}`}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  );
}

// Coloured info panel with an uppercase title
function Box({ tone, icon, title, children }: { tone: keyof typeof boxTones; icon?: ReactNode; title: string; children: ReactNode }) {
  const [box, titleCls] = boxTones[tone];
  return (
    <div className={`mt-3 rounded-lg border p-3 ${box}`}>
      <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${titleCls}`}>{icon}{title}</p>
      {children}
    </div>
  );
}

function PaymentPreviewModal({ preview, onClose }: { preview: { url: string; orderNumber: string }; onClose: () => void }) {
  const isPdf = preview.url.toLowerCase().split("?")[0].endsWith(".pdf");
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Payment file for order ${preview.orderNumber}`}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Payment file · {preview.orderNumber}</h2>
          <div className="flex items-center gap-3">
            <a href={preview.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-[#cf5427] hover:underline">
              Open in new tab <ExternalLink size={14} />
            </a>
            <button type="button" onClick={onClose} aria-label="Close payment file preview" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X size={18} /></button>
          </div>
        </div>
        <div className="relative min-h-[50vh] flex-1 bg-slate-100">
          {isPdf ? (
            <iframe src={preview.url} title={`Payment file for order ${preview.orderNumber}`} className="h-[75vh] w-full" />
          ) : (
            <Image
              src={preview.url}
              alt={`Uploaded payment file for order ${preview.orderNumber}`}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 896px"
              className="object-contain p-3"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [sendingRewardId, setSendingRewardId] = useState("");
  const [paymentActionId, setPaymentActionId] = useState("");
  const [paymentPreview, setPaymentPreview] = useState<{ url: string; orderNumber: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/admin/orders");
      setOrders(response.data?.orders || []);
    } catch (requestError) {
      setError(apiError(requestError, "Could not load orders."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  // Clear messages, mark the order busy, run the request, report failures
  const perform = async (setBusy: (id: string) => void, id: string, fallback: string, request: () => Promise<void>) => {
    setBusy(id);
    setError("");
    setNotice(null);
    try {
      await request();
    } catch (requestError) {
      setError(apiError(requestError, fallback));
    } finally {
      setBusy("");
    }
  };

  const patchOrder = (id: string, update: (order: Order) => Order) =>
    setOrders((current) => current.map((item) => (item.id === id ? update(item) : item)));

  const updateStatus = (order: Order, status: OrderStatus) =>
    perform(setUpdatingId, order.id, "Could not update order status.", async () => {
      const response = await api.patch(`/api/admin/orders/${order.id}/status`, { status });
      patchOrder(order.id, () => response.data.order);
      const n = order.orderNumber;
      setNotice({
        type: "success",
        message:
          status === "CONFIRMED" ? `Order ${n} confirmed — approval email & SMS are being sent.`
          : status === "CANCELLED" ? `Order ${n} rejected.`
          : `Order ${n} updated to ${status}.`,
      });
    });

  const sendOrderReward = (order: Order) => {
    const rule = order.qualifiedRule;
    if (!rule) return;
    return perform(setSendingRewardId, order.id, "Could not send reward.", async () => {
      const { data } = await api.post("/api/admin/rewards/dispatch", { rewardRuleId: rule.id, orderId: order.id, channel: "BOTH" });
      setNotice({
        type: data.success ? "success" : "warning",
        message: data.success
          ? `Reward "${rule.name}" sent for order ${order.orderNumber}.`
          : `Reward dispatch failed for order ${order.orderNumber}.`,
      });
      if (data.dispatch) {
        patchOrder(order.id, (item) => ({ ...item, rewardDispatches: [data.dispatch, ...(item.rewardDispatches || [])] }));
      }
    });
  };

  const deleteOrder = (order: Order) => {
    if (!window.confirm(`Delete order ${order.orderNumber}? This cannot be undone. Product stock will be restored.`)) return;
    return perform(setDeletingId, order.id, "Could not delete order.", async () => {
      await api.delete(`/api/admin/orders/${order.id}`);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice({ type: "success", message: `Order ${order.orderNumber} deleted and stock restored.` });
    });
  };

  const reviewPayment = (order: Order, action: "approve" | "reject") => {
    const note = window.prompt(`${action === "approve" ? "Approve" : "Reject"} payment for ${order.orderNumber}? Optional note:`);
    if (note === null) return; // cancelled
    return perform(setPaymentActionId, order.id, "Could not update payment verification.", async () => {
      const response = await api.patch(`/api/admin/orders/${order.id}/payment`, { action, note: note.trim() || undefined });
      const updated = response.data?.order;
      if (updated) {
        patchOrder(order.id, (item) => ({
          ...item,
          paymentStatus: updated.paymentStatus,
          transactionRef: updated.transactionRef,
          paymentScreenshotUrl: updated.paymentScreenshotUrl,
          verificationMethod: updated.verificationMethod,
          verificationNotes: updated.verificationNotes,
          verifiedAt: updated.verifiedAt,
        }));
      }
      setNotice({
        type: "success",
        message: action === "approve"
          ? `Payment for ${order.orderNumber} approved — marked VERIFIED.`
          : `Payment for ${order.orderNumber} rejected.`,
      });
    });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#cf5427]">Sales management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">Review customer orders and approve or reject pending requests.</p>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && (
        <p
          role={notice.type === "warning" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            notice.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.message}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" /></div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No orders yet</h2>
            <p className="mt-1 text-sm text-slate-500">Customer orders placed through the storefront will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const proofUrl = order.paymentScreenshotUrl || order.paymentProofUrl;
              const payStatus = order.paymentStatus || "UNVERIFIED";
              const flow = statusFlow[order.status];
              const statusLabel =
                order.status === "CONFIRMED" ? t("orders.status_approved", "Approved")
                : order.status === "CANCELLED" ? t("orders.status_rejected", "Rejected")
                : t(`orders.status_${order.status.toLowerCase()}`, order.status);
              const rule = order.rewardQualified ? order.qualifiedRule : null;
              const updating = updatingId === order.id;
              const deleting = deletingId === order.id;
              const paying = paymentActionId === order.id;
              const sending = sendingRewardId === order.id;

              return (
                <article key={order.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setExpandedId((current) => (current === order.id ? "" : order.id))}
                      className="min-w-[220px] flex-1 text-left"
                    >
                      <span className="block font-bold text-slate-900">{order.orderNumber}</span>
                      <span className="mt-1 block text-sm text-slate-600">{order.customerName} · {order.customerEmail}</span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleString()} · {order.items.length} item(s)
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium text-slate-700">
                        {order.items.map((item) => `${item.productName || "Product name unavailable"} × ${item.quantity}`).join(", ")}
                      </span>
                    </button>
                    <strong className="text-sm text-slate-800">{money(order.total)}</strong>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${payBadgeCls(payStatus)}`} title={order.verificationNotes || undefined}>
                      PAY: {payStatus.replaceAll("_", " ")}
                    </span>
                    {rule && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Gift className="h-3 w-3" /> Reward Qualified
                      </span>
                    )}
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge[order.status]}`}>{statusLabel}</span>
                    {flow && (
                      <div className="flex items-center gap-2">
                        <Btn tone={flow.tone} busy={updating} icon={<Check className="h-3.5 w-3.5" />} disabled={updating} onClick={() => void updateStatus(order, flow.to)}>{t(flow.key, flow.label)}</Btn>
                        {flow.cancel && (
                          <Btn tone="red" icon={<X className="h-3.5 w-3.5" />} disabled={updating} onClick={() => void updateStatus(order, "CANCELLED")}>{t(...flow.cancel)}</Btn>
                        )}
                      </div>
                    )}
                    <Btn tone="red" busy={deleting} icon={<Trash2 className="h-3.5 w-3.5" />} disabled={deleting} onClick={() => void deleteOrder(order)} aria-label={`Delete order ${order.orderNumber}`}>
                      {t("orders.delete", "Delete")}
                    </Btn>
                  </div>

                  {expandedId === order.id && (
                    <div className="mt-4 grid gap-5 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer details</h3>
                        <p className="mt-2 text-sm text-slate-800">{order.customerName}</p>
                        <p className="text-sm text-slate-600">{order.customerPhone}</p>
                        <p className="text-sm text-slate-600">{order.shippingAddress}</p>

                        {order.deliveryRegion && (
                          <Box tone="blue" icon={<MapPin className="h-3.5 w-3.5" />} title="Delivery Region">
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {order.deliveryRegion.name}
                              {order.deliveryRegion.country ? ` (${order.deliveryRegion.country})` : ""}
                            </p>
                            <p className="text-xs text-slate-600">Flat delivery fee: {money(Number(order.deliveryRegion.fee))}</p>
                          </Box>
                        )}

                        {(order.deliveryVerified || order.customerLat != null) && (
                          <Box tone="emerald" icon={<MapPin className="h-3.5 w-3.5" />} title="Verified Delivery Location">
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              {order.gpsAccuracy != null ? `Verified GPS (±${Math.round(order.gpsAccuracy)}m)` : "GPS verified"}
                              {order.deliveryDistanceKm != null && ` · ${order.deliveryDistanceKm} km from store`}
                            </p>
                            {order.geoAddress && <p className="mt-1 text-xs text-slate-600">{order.geoAddress}</p>}
                            {order.landmark && <p className="mt-1 text-xs text-slate-600"><strong>Landmark:</strong> {order.landmark}</p>}
                            {order.deliveryMapsUrl && (
                              <a href={order.deliveryMapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#cf5427] underline underline-offset-2">
                                Open in Google Maps <ExternalLink size={11} />
                              </a>
                            )}
                          </Box>
                        )}

                        <Box tone="slate" title="Payment method">
                          <p className="mt-1 text-sm font-semibold text-slate-800">{paymentMethodLabel(order.paymentMethod)}</p>
                          {proofUrl ? (
                            <button type="button" onClick={() => setPaymentPreview({ url: proofUrl, orderNumber: order.orderNumber })}
                              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#cf5427] underline underline-offset-2">
                              View uploaded payment file
                            </button>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">No payment file was uploaded.</p>
                          )}
                          {(order.transactionRef || order.verificationNotes || order.verifiedAt) && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                              {order.transactionRef && (
                                <p><span className="font-semibold">Ref:</span> <span className="font-mono">{order.transactionRef}</span></p>
                              )}
                              {order.verifiedAt && (
                                <p>
                                  <span className="font-semibold">Verified:</span> {new Date(order.verifiedAt).toLocaleString()}
                                  {order.verificationMethod ? ` via ${order.verificationMethod}` : ""}
                                </p>
                              )}
                              {order.verificationNotes && <p className="mt-1 text-slate-500">{order.verificationNotes}</p>}
                            </div>
                          )}
                          {proofUrl && payStatus !== "VERIFIED" && payStatus !== "REJECTED" && (
                            <div className="mt-2 flex items-center gap-2">
                              <Btn small tone="emerald" busy={paying} icon={<Check className="h-3.5 w-3.5" />} disabled={paying} onClick={() => void reviewPayment(order, "approve")}>
                                Approve payment
                              </Btn>
                              <Btn small tone="red" icon={<X className="h-3.5 w-3.5" />} disabled={paying} onClick={() => void reviewPayment(order, "reject")}>
                                Reject payment
                              </Btn>
                            </div>
                          )}
                        </Box>
                      </div>

                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Items</h3>
                        <ul className="mt-2 space-y-2">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex items-center gap-3 text-sm">
                              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                {item.image ? (
                                  <Image src={item.image} alt={item.productName} fill unoptimized sizes="48px" className="object-cover" />
                                ) : (
                                  <ShoppingCart className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-slate-300" />
                                )}
                              </div>
                              <span className="min-w-0 flex-1 text-slate-700">{item.productName || "Product name unavailable"} × {item.quantity}</span>
                              <span className="whitespace-nowrap font-medium text-slate-800">{money(item.unitPrice * item.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                        {order.note && (
                          <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600"><strong>Note:</strong> {order.note}</p>
                        )}

                        {rule && (
                          <Box tone="amber" icon={<Gift className="h-3.5 w-3.5" />} title="Reward Qualified">
                            <p className="mt-1 text-sm font-semibold text-slate-800">{rule.name}</p>
                            <p className="text-xs text-slate-600">
                              {rule.rewardValue}
                              {["FIXED_CASHBACK", "MOBILE_AIRTIME"].includes(rule.rewardType) && ` ${rule.currency || "ETB"}`}
                              {rule.promoCode ? ` · Code: ${rule.promoCode}` : ""}
                              {rule.payoutMethod && rule.payoutMethod !== "AUTO" ? ` · via ${rule.payoutMethod.replace(/_/g, " ")}` : ""}
                            </p>
                            {(order.rewardDispatches || []).length > 0 && (
                              <p className="mt-1 text-xs text-slate-500">
                                Dispatched: {(order.rewardDispatches || []).map((d) => `${d.channel} · ${d.status}`).join(", ")}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Btn small tone="amber" busy={sending} icon={<Send className="h-3.5 w-3.5" />} disabled={sending} onClick={() => void sendOrderReward(order)}>
                                Send Reward (SMS + Email)
                              </Btn>
                              <Link href={`/admin/rewards?order=${order.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-50">
                                <ExternalLink className="h-3.5 w-3.5" /> Open in Rewards
                              </Link>
                            </div>
                          </Box>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {paymentPreview && <PaymentPreviewModal preview={paymentPreview} onClose={() => setPaymentPreview(null)} />}
    </section>
  );
}