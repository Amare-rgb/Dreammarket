"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/app/providers";
import { useLanguage } from "@/context/LanguageContext";
import { api, uploadApi } from "@/lib/api";
import { CartItem, readCart, writeCart } from "@/app/lib/cart";

interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  note: string;
}

interface CreatedOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  image: string | null;
}

interface CreatedOrder {
  orderNumber: string;
  status: string;
  createdAt: string;
  total: number;
  paymentMethod: string;
  shippingAddress: string;
  customerName: string;
  customerPhone: string;
  paymentProofUrl: string | null;
  items: CreatedOrderItem[];
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
  return message || "We could not place your order. Please try again.";
}

export default function CheckoutPage() {
  const { user, status } = useAuth();
  const { t } = useLanguage();
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
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentProofError, setPaymentProofError] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
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

  const uploadPaymentProof = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPaymentProofUrl("");
    setPaymentProofName("");
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
      setPaymentProofError(
        "The file could not be uploaded. Please try again."
      );
    } finally {
      setUploadingProof(false);
    }
  };

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (items.length === 0) {
      setError("Your order is empty. Add a product before checking out.");
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
        shippingAddress: form.shippingAddress,
        note: form.note,
        paymentMethod: "CASH_ON_DELIVERY",
        paymentProofUrl: paymentProofUrl || undefined,
        items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      });
      const order = response.data.order as CreatedOrder;
      setCreatedOrder({
        ...order,
        items: order.items.map((item) => ({
          ...item,
          image:
            item.image ||
            items.find((cartItem) => cartItem.productId === item.productId)
              ?.image ||
            null,
        })),
      });
      updateCart([]);
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

  if (createdOrder) {
    return (
      <main className="min-h-screen bg-[var(--cream)] px-4 pb-12 pt-24 sm:px-6">
        <section className="mx-auto max-w-xl overflow-hidden rounded-xl border border-green-200 bg-white shadow-md shadow-green-950/10">
          <div className="bg-[#15803d] px-4 py-3.5 text-white sm:px-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold leading-6">
                  {t("checkout.success_title", "Order received successfully")}
                </h1>
                <p className="mt-0.5 text-xs leading-4 text-green-50">
                  {t(
                    "checkout.success_message",
                    "Your order is awaiting review. We’ll update you when it is approved. Pay when your order is delivered."
                  )}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/25 pt-2 text-xs">
              <p className="min-w-0">
                <span className="text-green-100">
                  {t("checkout.success_order_number", "Order number")}:{" "}
                </span>
                <span className="break-all font-bold">{createdOrder.orderNumber}</span>
              </p>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#166534]">
                {t(
                  `orders.status_${createdOrder.status.toLowerCase()}`,
                  createdOrder.status.replaceAll("_", " ")
                )}
              </span>
            </div>
          </div>
          <div className="space-y-3 p-3.5 sm:p-4">
            <section>
              <h2 className="text-sm font-bold text-[#20283a]">
                {t("checkout.success_items_title", "Order summary")}
              </h2>
              <ul className="mt-1 divide-y divide-slate-100">
                {createdOrder.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 py-1.5">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.productName}
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-semibold text-slate-800">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {money(item.unitPrice)} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-slate-800">
                      {money(item.unitPrice * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-[#20283a]">
                <span>{t("checkout.success_total", "Order total")}</span>
                <span>{money(createdOrder.total)}</span>
              </div>
            </section>
            <section className="grid gap-2 rounded-lg bg-slate-50 p-2.5 text-[11px] sm:grid-cols-2">
              <div>
                <h2 className="text-xs font-bold text-[#20283a]">
                  {t("checkout.success_delivery_title", "Delivery details")}
                </h2>
                <p className="mt-1 font-semibold text-slate-700">
                  {createdOrder.customerName}
                </p>
                <p className="text-slate-600">{createdOrder.customerPhone}</p>
                <p className="whitespace-pre-wrap text-slate-600">
                  {createdOrder.shippingAddress}
                </p>
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#20283a]">
                  {t("checkout.success_payment_title", "Payment")}
                </h2>
                <p className="mt-1 text-slate-600">
                  {t("checkout.cash_on_delivery", "Cash on delivery")}
                </p>
                <p className="text-slate-500">
                  {new Date(createdOrder.createdAt).toLocaleString()}
                </p>
                {createdOrder.paymentProofUrl && (
                  <a
                    href={createdOrder.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-semibold text-[#cf5427] underline"
                  >
                    {t(
                      "checkout.success_payment_info",
                      "View uploaded payment information"
                    )}
                  </a>
                )}
              </div>
            </section>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/orders"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#20283a] px-3.5 text-xs font-bold text-white hover:bg-[#30384f]"
              >
                {t("checkout.success_view_orders", "View my orders")}
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t("checkout.success_continue_shopping", "Continue shopping")}
              </Link>
            </div>
          </div>
        </section>
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
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Address
                  <textarea
                    required
                    maxLength={1000}
                    rows={2}
                    value={form.shippingAddress}
                    onChange={(event) =>
                      setForm({ ...form, shippingAddress: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#EB6D3D]"
                  />
                </label>
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
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-4 text-base font-bold text-[#20283a]">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Final prices and available stock are verified when you place
                the order.
              </p>
              <button
                type="submit"
                disabled={submitting || uploadingProof || items.length === 0}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
