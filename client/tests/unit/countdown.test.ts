import { describe, it, expect } from "vitest";
import {
  getCountdownBadges,
  formatLong,
  formatClock,
} from "../../components/shop/countdown";

const NOW = new Date("2026-11-16T12:00:00Z").getTime();
const future = (ms: number) => new Date(NOW + ms).toISOString();
const past = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("getCountdownBadges", () => {
  it("returns no badges for a normal in-stock product", () => {
    expect(getCountdownBadges({ stock: 50 }, NOW)).toEqual([]);
  });

  it("shows arriving badge when availableAt is in the future", () => {
    const badges = getCountdownBadges(
      { stock: 10, availableAt: future(2 * DAY + 5 * HOUR) },
      NOW
    );
    expect(badges).toHaveLength(1);
    expect(badges[0].kind).toBe("arriving");
    expect(badges[0].targetMs).toBe(NOW + 2 * DAY + 5 * HOUR);
  });

  it("ignores availableAt in the past", () => {
    expect(
      getCountdownBadges({ stock: 10, availableAt: past(DAY) }, NOW)
    ).toEqual([]);
  });

  it("shows out_of_stock when stock is 0", () => {
    const badges = getCountdownBadges({ stock: 0 }, NOW);
    expect(badges.map((b) => b.kind)).toEqual(["out_of_stock"]);
  });

  it("shows restocking badge when out of stock with future restockDate", () => {
    const badges = getCountdownBadges(
      { stock: 0, restockDate: future(3 * DAY) },
      NOW
    );
    expect(badges.map((b) => b.kind)).toEqual(["out_of_stock", "restocking"]);
  });

  it("does not show restocking when restockDate is in the past", () => {
    const badges = getCountdownBadges(
      { stock: 0, restockDate: past(DAY) },
      NOW
    );
    expect(badges.map((b) => b.kind)).toEqual(["out_of_stock"]);
  });

  it("shows low_stock when 0 < stock <= 5", () => {
    expect(getCountdownBadges({ stock: 5 }, NOW)[0].kind).toBe("low_stock");
    expect(getCountdownBadges({ stock: 1 }, NOW)[0].kind).toBe("low_stock");
    expect(getCountdownBadges({ stock: 6 }, NOW)).toEqual([]);
  });

  it("low_stock badge carries the stock count", () => {
    const badges = getCountdownBadges({ stock: 3 }, NOW);
    expect(badges[0].stock).toBe(3);
  });

  it("shows sale_ending when saleEndDate is in the future", () => {
    const badges = getCountdownBadges(
      { stock: 20, saleEndDate: future(4 * HOUR) },
      NOW
    );
    expect(badges).toHaveLength(1);
    expect(badges[0].kind).toBe("sale_ending");
  });

  it("ignores saleEndDate in the past", () => {
    expect(
      getCountdownBadges({ stock: 20, saleEndDate: past(HOUR) }, NOW)
    ).toEqual([]);
  });

  it("combines multiple badges in priority order", () => {
    const badges = getCountdownBadges(
      {
        stock: 3,
        availableAt: future(DAY),
        saleEndDate: future(2 * HOUR),
      },
      NOW
    );
    expect(badges.map((b) => b.kind)).toEqual([
      "arriving",
      "low_stock",
      "sale_ending",
    ]);
  });

  it("handles invalid date strings gracefully", () => {
    expect(
      getCountdownBadges(
        { stock: 10, availableAt: "not-a-date", saleEndDate: "" },
        NOW
      )
    ).toEqual([]);
  });

  it("treats negative stock as out of stock", () => {
    expect(getCountdownBadges({ stock: -2 }, NOW)[0].kind).toBe(
      "out_of_stock"
    );
  });
});

describe("formatLong", () => {
  it("formats days, hours and minutes", () => {
    expect(formatLong(2 * DAY + 5 * HOUR + 30 * 60_000)).toBe("2d 5h 30m");
  });
  it("formats hours and minutes under a day", () => {
    expect(formatLong(3 * HOUR + 12 * 60_000)).toBe("3h 12m");
  });
  it("formats minutes only under an hour", () => {
    expect(formatLong(45 * 60_000)).toBe("45m");
  });
  it("clamps negative values to 0m", () => {
    expect(formatLong(-5000)).toBe("0m");
  });
});

describe("formatClock", () => {
  it("formats HHh MMm SSs", () => {
    expect(formatClock(4 * HOUR + 22 * 60_000 + 15_000)).toBe("04h 22m 15s");
  });
  it("pads single digits", () => {
    expect(formatClock(5 * 60_000 + 7_000)).toBe("00h 05m 07s");
  });
  it("clamps negative values", () => {
    expect(formatClock(-1000)).toBe("00h 00m 00s");
  });
});
