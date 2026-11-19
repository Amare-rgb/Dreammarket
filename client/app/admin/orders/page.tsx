"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Check,
  ExternalLink,
  Gift,
  LoaderCircle,
  MapPin,
  Send,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  image: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  note: string | null;
  paymentMethod: string;
  paymentProofUrl: string | null;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items: OrderItem[];
  rewardQualified?: boolean;
  qualifiedRule?: {
    id: string;
    name: string;
    rewardType: string;
    rewardValue: string;
    promoCode: string | null;
    triggerType: string;
    threshold: number;
    scope: string;
  } | null;
  rewardDispatches?: {
    id: string;
    channel: string;
    status: string;
    sentAt: string | null;
    createdAt: string;
  }[];
  deliveryFee?: number | null;
  deliveryDistanceKm?: number | null;
  deliveryMapsUrl?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  gpsAccuracy?: number | null;
  geoAddress?: string | null;
  landmark?: string | null;
  deliveryVerified?: boolean;
  deliveryRegion?: {
    id: string;
    name: string;
    country: string | null;
    fee: number;
  } | null;
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);

export default function AdminOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [sendingRewardId, setSendingRewardId] = useState("");
  const [paymentPreview, setPaymentPreview] = useState<{
    url: string;
    orderNumber: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "warning";
    message: string;
  } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/admin/orders");
      setOrders(response.data?.orders || []);
    } catch (requestError) {
      setError(
        (requestError as { response?: { data?: { error?: string } } }).response
          ?.data?.error || "Could not load orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOrders();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const updateStatus = async (order: Order, status: OrderStatus) => {
    setUpdatingId(order.id);
    setError("");
    setNotice(null);
    try {
      const response = await api.patch(
        `/api/admin/orders/${order.id}/status`,
        { status }
      );
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? response.data.order : item
        )
      );
      if (status === "CONFIRMED") {
        setNotice({
          type: "success",
          message: `Order ${order.orderNumber} confirmed — approval email & SMS are being sent.`,
        });
      } else {
        setNotice({
          type: "success",
          message:
            status === "CANCELLED"
              ? `Order ${order.orderNumber} rejected.`
              : `Order ${order.orderNumber} updated to ${status}.`,
        });
      }
    } catch (requestError) {
      setError(
        (requestError as { response?: { data?: { error?: string } } }).response
          ?.data?.error || "Could not update order status."
      );
    } finally {
      setUpdatingId("");
    }
  };

  const sendOrderReward = async (order: Order) => {
    if (!order.qualifiedRule) return;
    setSendingRewardId(order.id);
    setError("");
    setNotice(null);
    try {
      const response = await api.post("/api/admin/rewards/dispatch", {
        rewardRuleId: order.qualifiedRule.id,
        orderId: order.id,
        channel: "BOTH",
      });
      setNotice({
        type: response.data.success ? "success" : "warning",
        message: response.data.success
          ? `Reward "${order.qualifiedRule.name}" sent for order ${order.orderNumber}.`
          : `Reward dispatch failed for order ${order.orderNumber}.`,
      });
      if (response.data.dispatch) {
        setOrders((current) =>
          current.map((item) =>
            item.id === order.id
              ? {
                  ...item,
                  rewardDispatches: [
                    response.data.dispatch,
                    ...(item.rewardDispatches || []),
                  ],
                }
              : item
          )
        );
      }
    } catch (requestError) {
      setError(
        (requestError as { response?: { data?: { error?: string } } }).response
          ?.data?.error || "Could not send reward."
      );
    } finally {
      setSendingRewardId("");
    }
  };

  const deleteOrder = async (order: Order) => {
    const confirmed = window.confirm(
      `Delete order ${order.orderNumber}? This cannot be undone. Product stock will be restored.`
    );
    if (!confirmed) return;

    setDeletingId(order.id);
    setError("");
    setNotice(null);
    try {
      await api.delete(`/api/admin/orders/${order.id}`);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setNotice({
        type: "success",
        message: `Order ${order.orderNumber} deleted and stock restored.`,
      });
    } catch (requestError) {
      setError(
        (requestError as { response?: { data?: { error?: string } } }).response
          ?.data?.error || "Could not delete order."
      );
    } finally {
      setDeletingId("");
    }
  };

  const paymentMethodLabel = (method: string) =>
    method
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#cf5427]">Sales management</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review customer orders and approve or reject pending requests.
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p
          role={notice.type === "warning" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.message}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoaderCircle className="h-7 w-7 animate-spin text-[#F47822]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShoppingCart className="mx-auto h-9 w-9 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">No orders yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Customer orders placed through the storefront will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const paymentProofUrl = order.paymentProofUrl;
              const statusLabel =
                order.status === "CONFIRMED"
                  ? t("orders.status_approved", "Approved")
                  : order.status === "CANCELLED"
                    ? t("orders.status_rejected", "Rejected")
                    : t(
                        `orders.status_${order.status.toLowerCase()}`,
                        order.status
                      );
              return (
                <article key={order.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((current) =>
                          current === order.id ? "" : order.id
                        )
                      }
                      className="min-w-[220px] flex-1 text-left"
                    >
                      <span className="block font-bold text-slate-900">
                        {order.orderNumber}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {order.customerName} · {order.customerEmail}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleString()} ·{" "}
                        {order.items.length} item(s)
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium text-slate-700">
                        {order.items
                          .map(
                            (item) =>
                              `${item.productName || "Product name unavailable"} × ${item.quantity}`
                          )
                          .join(", ")}
                      </span>
                    </button>
                    <strong className="text-sm text-slate-800">
                      {money(order.total)}
                    </strong>
                    {order.rewardQualified && order.qualifiedRule && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Gift className="h-3 w-3" /> Reward Qualified
                      </span>
                    )}
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      order.status === "CONFIRMED"
                        ? "bg-green-50 text-green-800"
                        : order.status === "PROCESSING"
                          ? "bg-blue-50 text-blue-800"
                          : order.status === "SHIPPED"
                            ? "bg-indigo-50 text-indigo-800"
                            : order.status === "DELIVERED"
                              ? "bg-emerald-50 text-emerald-800"
                              : order.status === "CANCELLED"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-700"
                    }`}>
                      {statusLabel}
                    </span>
                    {order.status === "PENDING" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => void updateStatus(order, "CONFIRMED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-700 px-3 text-xs font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === order.id ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {t("orders.approve", "Approve")}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => void updateStatus(order, "CANCELLED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("orders.reject", "Reject")}
                        </button>
                      </div>
                    )}
                    {order.status === "CONFIRMED" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => void updateStatus(order, "PROCESSING")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === order.id ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {t("orders.start_processing", "Start processing")}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => void updateStatus(order, "CANCELLED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("orders.cancel", "Cancel")}
                        </button>
                      </div>
                    )}
                    {order.status === "PROCESSING" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => void updateStatus(order, "SHIPPED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === order.id ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          {t("orders.mark_shipped", "Mark as shipped")}
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => void updateStatus(order, "CANCELLED")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("orders.cancel", "Cancel")}
                        </button>
                      </div>
                    )}
                    {order.status === "SHIPPED" && (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => void updateStatus(order, "DELIVERED")}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === order.id ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {t("orders.mark_delivered", "Mark as delivered")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === order.id}
                      onClick={() => void deleteOrder(order)}
                      aria-label={`Delete order ${order.orderNumber}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === order.id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      {t("orders.delete", "Delete")}
                    </button>
                  </div>

                  {expandedId === order.id && (
                    <div className="mt-4 grid gap-5 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Customer details
                        </h3>
                        <p className="mt-2 text-sm text-slate-800">
                          {order.customerName}
                        </p>
                        <p className="text-sm text-slate-600">
                          {order.customerPhone}
                        </p>
                        <p className="text-sm text-slate-600">
                          {order.shippingAddress}
                        </p>
                        {order.deliveryRegion && (
                          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-800">
                              <MapPin className="h-3.5 w-3.5" /> Delivery Region
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {order.deliveryRegion.name}
                              {order.deliveryRegion.country
                                ? ` (${order.deliveryRegion.country})`
                                : ""}
                            </p>
                            <p className="text-xs text-slate-600">
                              Flat delivery fee: {money(Number(order.deliveryRegion.fee))}
                            </p>
                          </div>
                        )}
                        {(order.deliveryVerified || order.customerLat != null) && (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
                              <MapPin className="h-3.5 w-3.5" /> Verified Delivery Location
                            </p>
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              {order.gpsAccuracy != null
                                ? `Verified GPS (±${Math.round(order.gpsAccuracy)}m)`
                                : "GPS verified"}
                              {order.deliveryDistanceKm != null &&
                                ` · ${order.deliveryDistanceKm} km from store`}
                            </p>
                            {order.geoAddress && (
                              <p className="mt-1 text-xs text-slate-600">{order.geoAddress}</p>
                            )}
                            {order.landmark && (
                              <p className="mt-1 text-xs text-slate-600">
                                <strong>Landmark:</strong> {order.landmark}
                              </p>
                            )}
                            {order.deliveryMapsUrl && (
                              <a
                                href={order.deliveryMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#cf5427] underline underline-offset-2"
                              >
                                Open in Google Maps <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        )}
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Payment method
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {paymentMethodLabel(order.paymentMethod)}
                          </p>
                          {paymentProofUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPaymentPreview({
                                  url: paymentProofUrl,
                                  orderNumber: order.orderNumber,
                                })
                              }
                              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#cf5427] underline underline-offset-2"
                            >
                              View uploaded payment file
                            </button>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">
                              No payment file was uploaded.
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Items
                        </h3>
                        <ul className="mt-2 space-y-2">
                          {order.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center gap-3 text-sm"
                            >
                              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                {item.image ? (
                                  <Image
                                    src={item.image}
                                    alt={item.productName}
                                    fill
                                    unoptimized
                                    sizes="48px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <ShoppingCart className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-slate-300" />
                                )}
                              </div>
                              <span className="min-w-0 flex-1 text-slate-700">
                                {item.productName || "Product name unavailable"} ×{" "}
                                {item.quantity}
                              </span>
                              <span className="whitespace-nowrap font-medium text-slate-800">
                                {money(item.unitPrice * item.quantity)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {order.note && (
                          <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
                            <strong>Note:</strong> {order.note}
                          </p>
                        )}
                        {order.rewardQualified && order.qualifiedRule && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
                              <Gift className="h-3.5 w-3.5" /> Reward Qualified
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {order.qualifiedRule.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {order.qualifiedRule.rewardValue}
                              {order.qualifiedRule.promoCode
                                ? ` · Code: ${order.qualifiedRule.promoCode}`
                                : ""}
                            </p>
                            {(order.rewardDispatches || []).length > 0 && (
                              <p className="mt-1 text-xs text-slate-500">
                                Dispatched:{" "}
                                {(order.rewardDispatches || [])
                                  .map((d) => `${d.channel} · ${d.status}`)
                                  .join(", ")}
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={sendingRewardId === order.id}
                              onClick={() => void sendOrderReward(order)}
                              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {sendingRewardId === order.id ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              Send Reward (SMS + Email)
                            </button>
                          </div>
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
      {paymentPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Payment file for order ${paymentPreview.orderNumber}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaymentPreview(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-900">
                Payment file · {paymentPreview.orderNumber}
              </h2>
              <div className="flex items-center gap-3">
                <a
                  href={paymentPreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#cf5427] hover:underline"
                >
                  Open in new tab <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setPaymentPreview(null)}
                  aria-label="Close payment file preview"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="relative min-h-[50vh] flex-1 bg-slate-100">
              {paymentPreview.url.toLowerCase().split("?")[0].endsWith(".pdf") ? (
                <iframe
                  src={paymentPreview.url}
                  title={`Payment file for order ${paymentPreview.orderNumber}`}
                  className="h-[75vh] w-full"
                />
              ) : (
                <Image
                  src={paymentPreview.url}
                  alt={`Uploaded payment file for order ${paymentPreview.orderNumber}`}
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 896px"
                  className="object-contain p-3"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
