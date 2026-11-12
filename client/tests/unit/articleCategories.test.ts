import { describe, expect, it } from "vitest";
import {
  apiErrorText,
  categoryLabel,
  type ArticleCategory,
} from "../../app/lib/articleCategories";

describe("apiErrorText", () => {
  it("extracts the server error message", () => {
    const error = { response: { data: { error: "Name already exists" } } };
    expect(apiErrorText(error, "fallback")).toBe("Name already exists");
  });

  it("falls back to Error.message", () => {
    expect(apiErrorText(new Error("Network down"), "fallback")).toBe(
      "Network down"
    );
  });

  it("returns the fallback for unknown error shapes", () => {
    expect(apiErrorText({}, "fallback")).toBe("fallback");
    expect(apiErrorText(null, "fallback")).toBe("fallback");
    expect(apiErrorText("string error", "fallback")).toBe("fallback");
  });
});

describe("categoryLabel", () => {
  const categories: ArticleCategory[] = [
    { id: "1", name: "News", slug: "news", count: 5 },
    { id: "2", name: "Tips", slug: "tips", count: 3 },
  ];

  it("returns the category name for a known slug", () => {
    expect(categoryLabel(categories, "tips")).toBe("Tips");
  });

  it("returns the raw slug when no category matches", () => {
    expect(categoryLabel(categories, "custom-slug")).toBe("custom-slug");
  });

  it("returns 'General' when slug is missing", () => {
    expect(categoryLabel(categories, null)).toBe("General");
    expect(categoryLabel(categories, undefined)).toBe("General");
  });
});
