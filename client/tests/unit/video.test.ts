import { describe, expect, it } from "vitest";
import { getVideoSource, isValidHttpUrl } from "../../app/lib/video";

describe("isValidHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isValidHttpUrl("https://example.com/video.mp4")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects non-http protocols and garbage", () => {
    expect(isValidHttpUrl("ftp://example.com/file")).toBe(false);
    expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("")).toBe(false);
  });
});

describe("getVideoSource — YouTube", () => {
  it("converts a watch URL to a nocookie embed", () => {
    const source = getVideoSource(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    expect(source).toEqual({
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("converts a youtu.be short link", () => {
    const source = getVideoSource("https://youtu.be/dQw4w9WgXcQ");
    expect(source?.kind).toBe("iframe");
    expect(source?.src).toContain("dQw4w9WgXcQ");
  });

  it("converts a /shorts/ URL", () => {
    const source = getVideoSource(
      "https://www.youtube.com/shorts/abc123XYZ_-"
    );
    expect(source?.kind).toBe("iframe");
    expect(source?.src).toContain("abc123XYZ_-");
  });
});

describe("getVideoSource — Vimeo", () => {
  it("converts a vimeo.com URL to a player embed", () => {
    const source = getVideoSource("https://vimeo.com/123456789");
    expect(source).toEqual({
      kind: "iframe",
      src: "https://player.vimeo.com/video/123456789",
    });
  });
});

describe("getVideoSource — direct files and links", () => {
  it("detects direct video files", () => {
    for (const ext of ["mp4", "webm", "mov", "m4v"]) {
      const source = getVideoSource(
        `https://cdn.example.com/video.${ext}`
      );
      expect(source?.kind).toBe("file");
    }
  });

  it("falls back to a generic link for other URLs", () => {
    const source = getVideoSource("https://example.com/watch/123");
    expect(source).toEqual({
      kind: "link",
      src: "https://example.com/watch/123",
    });
  });

  it("returns null for invalid input", () => {
    expect(getVideoSource("")).toBeNull();
    expect(getVideoSource("   ")).toBeNull();
    expect(getVideoSource("not a url")).toBeNull();
    expect(getVideoSource("ftp://example.com/v.mp4")).toBeNull();
  });
});
