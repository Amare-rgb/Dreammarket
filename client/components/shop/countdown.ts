// Pure countdown logic for product stock/arrival/sale badges.
// Kept framework-free so it can be unit-tested with vitest.

export interface CountdownInput {
  stock: number;
  availableAt?: string | null;
  restockDate?: string | null;
  saleEndDate?: string | null;
}

export type CountdownBadgeKind =
  | "arriving"
  | "out_of_stock"
  | "restocking"
  | "low_stock"
  | "sale_ending";

export interface CountdownBadge {
  kind: CountdownBadgeKind;
  /** epoch ms the countdown targets (for arriving/restocking/sale_ending) */
  targetMs?: number;
  /** remaining stock for low_stock badge */
  stock?: number;
}

const LOW_STOCK_THRESHOLD = 5;

function toMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Evaluate which countdown badges apply to a product at a given moment.
 * Returns badges in display priority order.
 */
export function getCountdownBadges(
  input: CountdownInput,
  now: number = Date.now()
): CountdownBadge[] {
  const badges: CountdownBadge[] = [];
  const stock = Number(input.stock) || 0;

  const availableAtMs = toMs(input.availableAt);
  const restockMs = toMs(input.restockDate);
  const saleEndMs = toMs(input.saleEndDate);

  const isUpcoming = availableAtMs !== null && availableAtMs > now;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  const saleEnding = saleEndMs !== null && saleEndMs > now;
  const restocking =
    isOutOfStock && restockMs !== null && restockMs > now;

  if (isUpcoming) {
    badges.push({ kind: "arriving", targetMs: availableAtMs });
  }
  if (isOutOfStock) {
    badges.push({ kind: "out_of_stock" });
  }
  if (restocking) {
    badges.push({ kind: "restocking", targetMs: restockMs });
  }
  if (isLowStock) {
    badges.push({ kind: "low_stock", stock });
  }
  if (saleEnding) {
    badges.push({ kind: "sale_ending", targetMs: saleEndMs });
  }

  return badges;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2d 5h 30m" style for longer durations */
export function formatLong(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** "04h 22m 15s" ticking style for short durations */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
}
