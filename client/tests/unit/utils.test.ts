import { describe, expect, it } from "vitest";
import { cn } from "../../app/lib/utils";

describe("cn (clsx + tailwind-merge)", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("ignores falsy values", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("merges conflicting Tailwind classes keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-red-500", "text-lg")).toBe("text-red-500 text-lg");
  });

  it("supports conditional object syntax", () => {
    expect(cn({ "bg-red-500": true, "bg-blue-500": false }, "p-4")).toBe(
      "bg-red-500 p-4"
    );
  });
});
