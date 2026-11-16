"use client";

import { useEffect, useState } from "react";
import { Clock, Flame, PackageX, Truck } from "lucide-react";
import { formatClock, formatLong, getCountdownBadges, type CountdownBadgeKind } from "./countdown";

interface ProductCountdownProps {
  stock: number;
  availableAt?: string | null;
  restockDate?: string | null;
  saleEndDate?: string | null;
  /** "card" = compact badges for grid cards, "detail" = larger badges for PDP */
  variant?: "card" | "detail";
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const BADGE_STYLES: Record<CountdownBadgeKind, string> = {
  arriving: "bg-indigo-600 text-white",
  out_of_stock: "bg-slate-800 text-white",
  restocking: "bg-amber-500 text-white",
  low_stock: "bg-red-600 text-white",
  sale_ending: "bg-emerald-600 text-white",
};

function BadgeIcon({ kind, compact }: { kind: CountdownBadgeKind; compact: boolean }) {
  const cls = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  switch (kind) {
    case "arriving": return <Truck className={cls} />;
    case "out_of_stock": return <PackageX className={cls} />;
    case "restocking":
    case "sale_ending": return <Clock className={cls} />;
    case "low_stock": return <Flame className={cls} />;
  }
}

export default function ProductCountdown({
  stock,
  availableAt,
  restockDate,
  saleEndDate,
  variant = "card",
}: ProductCountdownProps) {
  const now = useNow(1000);
  const badges = getCountdownBadges({ stock, availableAt, restockDate, saleEndDate }, now);
  if (badges.length === 0) return null;

  const compact = variant === "card";
  const badgeBase = compact
    ? "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
    : "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold";

  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-col gap-2"}>
      {badges.map((badge) => {
        let label: string;
        switch (badge.kind) {
          case "arriving": label = `Arriving in ${formatLong(badge.targetMs! - now)}`; break;
          case "out_of_stock": label = "Out of Stock"; break;
          case "restocking": label = `Restocking in ${formatLong(badge.targetMs! - now)}`; break;
          case "low_stock": label = `Hurry! Only ${badge.stock} item${badge.stock === 1 ? "" : "s"} left`; break;
          case "sale_ending": label = `Offer ends in ${formatClock(badge.targetMs! - now)}`; break;
        }
        return (
          <span key={badge.kind} className={`${badgeBase} ${BADGE_STYLES[badge.kind]}`}>
            <BadgeIcon kind={badge.kind} compact={compact} />
            {label}
          </span>
        );
      })}
    </div>
  );
}
