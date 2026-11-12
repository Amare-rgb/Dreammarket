"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/api";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  image: string | null;
}

interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentProofUrl: string | null;
  total: number;
  createdAt: string;
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  note: string | null;
  items: OrderItem[];
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);

const STATUS_STEPS: OrderStatus[] = ["PENDING", "CONFIRMED"];

function statusIndex(status: OrderStatus): number {
  if (status === "PENDING") return 0;
  if (status === "CANCELLED") return -1;
  return 1;
}

export default function OrderDetailPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { status: authStatus } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/api/orders/${orderNumber}`);
      setOrder(response.data?.order || null);
    } catch (requestError) {
      const message = (
        requestError as { response?: { data?: { error?: string } } }
      )?.response?.data?.error;
      setError(
        message || "This order could not be loaded. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/auth/signin");
    } else if (authStatus === "authenticated") {
      const timer = window.setTimeout(() => {
        void loadOrder();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [authStatus, router, loadOrder]);

  if (authStatus === "loading" || (authStatus === "authenticated" && loading)) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[var(--cream)]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </main>
    );
  }

  if (authStatus === "unauthenticated") return null;

  if (error || !order) {
    return (
      <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-3 text-lg font-bold text-slate-800">
            {t("orders.detail_not_found_title", "Order not found")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {error ||
              t(
                "orders.detail_not_found_desc",
                "We could not find this order in your account."
              )}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void loadOrder()}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t("orders.retry", "Try again")}
            </button>
            <Link
              href="/orders"
              className="inline-flex h-10 items-center rounded-xl bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] hover:bg-[#cf5427] hover:text-white"
            >
              {t("orders.back_to_orders", "My orders")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const currentStep = statusIndex(order.status);
  const isCancelled = order.status === "CANCELLED";
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return (
    <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#cf5427] hover:text-[#20283a]"
        >
          <ArrowLeft size={16} /> {t("orders.back_to_orders", "My orders")}
        </Link>

        {/* Header */}
        <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cf5427]">
              {t("orders.detail_label", "Order details")}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#20283a] sm:text-3xl">
              {order.orderNumber}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("orders.placed_on", "Placed on")}{" "}
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              isCancelled
                ? "bg-red-100 text-red-700"
                : "bg-[#EB6D3D]/15 text-[#20283a]"
            }`}
          >
            {t(
              `orders.status_${order.status.toLowerCase()}`,
              order.status.replaceAll("_", " ")
            )}
          </span>
        </header>

        {/* Status tracker */}
        {!isCancelled && (
          <section className="mt-6 rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#b98a3e]">
              {t("orders.tracking_title", "Order progress")}
            </h2>
            <div className="mt-4 flex items-center">
              {STATUS_STEPS.map((step, index) => {
                const done = index <= currentStep;
                const isLast = index === STATUS_STEPS.length - 1;
                return (
                  <div key={step} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          done
                            ? "bg-[#EB6D3D] text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      <span
                        className={`mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide ${
                          done ? "text-[#20283a]" : "text-slate-400"
                        }`}
                      >
                        {step === "CONFIRMED"
                          ? t("orders.status_approved", "Approved")
                          : t(
                              `orders.status_${step.toLowerCase()}`,
                              step.replaceAll("_", " ")
                            )}
                      </span>
                    </div>
                    {!isLast && (
                      <div
                        className={`mx-1 mb-5 h-0.5 flex-1 rounded ${
                          index < currentStep ? "bg-[#EB6D3D]" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isCancelled && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {t(
              "orders.cancelled_notice",
              "This order was cancelled. Contact support if you have questions."
            )}
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          {/* Items */}
          <section className="rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-[#20283a]">
              {t("orders.items_title", "Items")}
            </h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.productName}
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
                    <p className="font-semibold text-slate-800">
                      {item.productName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {money(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-slate-700">
                    {money(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Summary */}
          <aside className="h-fit space-y-6">
            <section className="rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[#20283a]">
                {t("orders.summary_title", "Order summary")}
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">
                    {t("orders.subtotal", "Subtotal")}
                  </dt>
                  <dd className="font-semibold text-slate-800">
                    {money(subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">
                    {t("orders.shipping", "Delivery")}
                  </dt>
                  <dd className="font-semibold text-slate-800">
                    {t("orders.free", "Free")}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-[#20283a]">
                  <dt>{t("orders.total_label", "Total")}</dt>
                  <dd>{money(order.total)}</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-[#20283a]">
                  {order.paymentMethod === "CASH_ON_DELIVERY"
                    ? t("orders.cash_on_delivery", "Cash on delivery")
                    : order.paymentMethod}
                </p>
                <p className="mt-1">
                  {t(
                    "orders.pay_on_delivery_note",
                    "Pay the delivery agent when your order arrives."
                  )}
                </p>
                {order.paymentProofUrl && (
                  <a
                    href={order.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-semibold text-[#cf5427] underline"
                  >
                    {t(
                      "orders.view_payment_info",
                      "View uploaded payment information"
                    )}
                  </a>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[#20283a]">
                {t("orders.delivery_title", "Delivery details")}
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {order.customerName}
              </p>
              <p className="text-sm text-slate-600">{order.customerPhone}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {order.shippingAddress}
              </p>
              {order.note && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  <span className="font-bold">
                    {t("orders.note_label", "Note")}:{" "}
                  </span>
                  {order.note}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white"
              >
                {t("orders.continue_shopping", "Continue shopping")}
              </Link>
              <Link
                href="/orders"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t("orders.all_orders", "All orders")}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
