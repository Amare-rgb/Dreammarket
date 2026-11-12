import { describe, expect, it } from "vitest";
import {
  categoryName,
  formatDate,
  readingMinutes,
  type PublicCategory,
} from "../../app/lib/publicArticles";

describe("formatDate", () => {
  it("formats an ISO date string", () => {
    const result = formatDate("2024-06-15T10:30:00.000Z");
    expect(result).toContain("2024");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("readingMinutes", () => {
  it("returns at least 1 minute for empty or short text", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("   ")).toBe(1);
    expect(readingMinutes("short article")).toBe(1);
  });

  it("calculates minutes at ~200 words per minute", () => {
    const words200 = Array(200).fill("word").join(" ");
    const words400 = Array(400).fill("word").join(" ");
    expect(readingMinutes(words200)).toBe(1);
    expect(readingMinutes(words400)).toBe(2);
  });
});

describe("categoryName", () => {
  const categories: PublicCategory[] = [
    { id: "1", name: "News", slug: "news", count: 5 },
    { id: "2", name: "Tips", slug: "tips", count: 3 },
  ];

  it("returns the category name for a known slug", () => {
    expect(categoryName(categories, "news")).toBe("News");
  });

  it("returns 'General' for unknown or missing slugs", () => {
    expect(categoryName(categories, "unknown")).toBe("General");
    expect(categoryName(categories, null)).toBe("General");
    expect(categoryName(categories, undefined)).toBe("General");
  });
});
