"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LoaderCircle, PackageCheck, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
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
  productName: string;
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
  items: OrderItem[];
}

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
  return message || "Your orders could not be loaded. Please try again.";
}

export default function OrdersPage() {
  const { status } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/orders");
      setOrders(response.data?.orders || []);
    } catch (requestError) {
      setError(responseError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    } else if (status === "authenticated") {
      const timer = window.setTimeout(() => {
        void loadOrders();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [status, router, loadOrders]);

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[var(--cream)]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </main>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <main className="min-h-screen bg-[var(--cream)] px-4 pb-16 pt-28 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cf5427]">
              {t("orders.account_label", "Your account")}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-[#20283a]">
              {t("orders.page_title", "My orders")}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t(
                "orders.page_description",
                "Track your orders, payment method, and delivery status."
              )}
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ShoppingBag size={16} /> {t("orders.shop_products", "Shop products")}
          </Link>
        </header>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p role="alert">{error}</p>
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="mt-2 font-bold underline"
            >
              {t("orders.retry", "Try again")}
            </button>
          </div>
        )}

        {!error && orders.length === 0 ? (
          <section className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 text-lg font-bold text-slate-800">
              {t("orders.empty_title", "No orders yet")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t(
                "orders.empty_description",
                "Once you place an order, its details and status will appear here."
              )}
            </p>
            <Link
              href="/shop"
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] hover:bg-[#cf5427] hover:text-white"
            >
              {t("orders.explore_products", "Explore products")}
            </Link>
          </section>
        ) : (
          <div className="mt-7 space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-[#f0e8d8] bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      {t("orders.order_number", "Order number")}
                    </p>
                    <h2 className="mt-1 font-bold text-[#20283a]">
                      {order.orderNumber}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#EB6D3D]/15 px-3 py-1 text-xs font-bold text-[#20283a]">
                      {t(
                        `orders.status_${order.status.toLowerCase()}`,
                        order.status.replaceAll("_", " ")
                      )}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.paymentMethod === "CASH_ON_DELIVERY"
                        ? t("orders.cash_on_delivery", "Cash on delivery")
                        : order.paymentMethod}
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100">
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
                <div className="flex flex-wrap items-start justify-between gap-3 border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      {t("orders.deliver_to", "Deliver to")}
                    </p>
                    <p className="mt-1 max-w-xl whitespace-pre-wrap text-sm text-slate-700">
                      {order.shippingAddress}
                    </p>
                    {order.paymentProofUrl && (
                      <a
                        href={order.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-[#cf5427] underline"
                      >
                        {t(
                          "orders.view_payment_info",
                          "View uploaded payment information"
                        )}
                      </a>
                    )}
                  </div>
                  <p className="text-right text-sm font-bold text-[#20283a]">
                    {t("orders.total_label", "Total")}{" "}
                    <span className="ml-2">{money(order.total)}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
