"use client";
import { Check, Package, Truck, XCircle } from "lucide-react";
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

interface OrderTrackingProps {
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
}
const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "PENDING", label: "Order placed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "On the way" },
  { key: "DELIVERED", label: "Delivered" },
];
const STATUS_INDEX: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PROCESSING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};
const DAY_MS = 24 * 60 * 60 * 1000;
function formatEta(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function etaMessage(status: OrderStatus, createdAt: string, updatedAt?: string): string {
  const now = Date.now();

  if (status === "DELIVERED") {
    const deliveredAt = updatedAt ? new Date(updatedAt) : new Date(createdAt);
    return `Delivered on ${deliveredAt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}.`;
  }
  if (status === "CANCELLED") {
    return "This order was cancelled.";
  }
  if (status === "SHIPPED") {
    const shippedAt = updatedAt ? new Date(updatedAt).getTime() : now;
    const eta = new Date(shippedAt + DAY_MS);
    if (eta.getTime() <= now) {
      return "Your order should arrive very soon.";
    }
    const hoursLeft = Math.max(1, Math.round((eta.getTime() - now) / (60 * 60 * 1000)));
    return `Expected to arrive within ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} (by ${formatEta(eta)}).`;
  }
  const eta = new Date(new Date(createdAt).getTime() + 3 * DAY_MS);
  if (eta.getTime() <= now) {
    return "Your order is on its way — delivery is imminent.";
  }
  return `Estimated delivery by ${formatEta(eta)}.`;
}

export default function OrderTracking({
  status,
  createdAt,
  updatedAt,
}: OrderTrackingProps) {
  if (status === "CANCELLED") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-bold text-red-700">Order cancelled</p>
          <p className="text-xs text-red-600">
            {etaMessage(status, createdAt, updatedAt)}
          </p>
        </div>
      </div>
    );
  }
  const currentIndex = STATUS_INDEX[status] ?? 0;
  const progress = (currentIndex / (STEPS.length - 1)) * 100;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      {/* Progress bar */}
      <div className="relative">
        <div className="absolute left-0 right-0 top-3 h-1 rounded-full bg-slate-200" />
        <div
          className="absolute left-0 top-3 h-1 rounded-full bg-[#EB6D3D] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
        <ol className="relative flex justify-between">
          {STEPS.map((step, index) => {
            const done = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <li key={step.key} className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors ${
                    done
                      ? "border-[#EB6D3D] bg-[#EB6D3D] text-white"
                      : "border-slate-300 bg-white text-slate-400"
                  } ${isCurrent ? "ring-4 ring-[#EB6D3D]/20" : ""}`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={`mt-1.5 text-center text-[10px] font-semibold leading-tight sm:text-xs ${
                    done ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Live status + ETA */}
      <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3">
        {status === "SHIPPED" ? (
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        ) : (
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-[#cf5427]" />
        )}
        <div>
          <p className="text-sm font-bold text-slate-800">
            {status === "SHIPPED"
              ? "On the way"
              : status === "DELIVERED"
                ? "Delivered"
                : status === "PROCESSING"
                  ? "Processing"
                  : status === "CONFIRMED"
                    ? "Confirmed"
                    : "Order placed"}
          </p>
          <p className="text-xs text-slate-600">
            {etaMessage(status, createdAt, updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
