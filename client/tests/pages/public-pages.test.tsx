import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// ── Module mocks (hoisted — must be literal vi.mock calls) ───────
vi.mock("next/navigation", async () => {
  const m = await import("../helpers/mocks");
  return m.nextNavigation();
});
vi.mock("next/link", async () => {
  const m = await import("../helpers/mocks");
  return m.nextLink();
});
vi.mock("next/image", async () => {
  const m = await import("../helpers/mocks");
  return m.nextImage();
});
vi.mock("@/lib/api", async () => {
  const m = await import("../helpers/mocks");
  return m.apiModule();
});
vi.mock("@/app/providers", async () => {
  const m = await import("../helpers/mocks");
  return m.providersModule();
});
vi.mock("react-hot-toast", async () => {
  const m = await import("../helpers/mocks");
  return m.toastModule();
});

import HomePage from "../../app/page";
import AboutPage from "../../app/about/page";
import ContactPage from "../../app/contact/page";
import UserSettingsPage from "../../app/settings/page";
import ArticlesPage from "../../app/articles/page";
import ArticlesVideosPage from "../../app/articles/videos/page";
import ArticleDetailPage from "../../app/articles/[slug]/page";

describe("public pages", () => {
  it("home page renders", () => {
    const html = renderToString(<HomePage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("about page renders", () => {
    const html = renderToString(<AboutPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("contact page renders", () => {
    const html = renderToString(<ContactPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("user settings page renders", () => {
    const html = renderToString(<UserSettingsPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("articles page renders", () => {
    const html = renderToString(<ArticlesPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("articles videos page renders", () => {
    const html = renderToString(<ArticlesVideosPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("article detail page renders", () => {
    const html = renderToString(<ArticleDetailPage />);
    expect(html.length).toBeGreaterThan(0);
  });
});
