import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

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

import ProfilePage from "../../app/profile/page";
import OrdersPage from "../../app/orders/page";
import OrderDetailPage from "../../app/orders/[orderNumber]/page";
import CheckoutPage from "../../app/checkout/page";

/**
 * Smoke tests for authenticated user pages.
 * useAuth is mocked as an authenticated user; api calls resolve empty.
 */
describe("user pages", () => {
  it("profile page renders", () => {
    const html = renderToString(<ProfilePage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("orders page renders", () => {
    const html = renderToString(<OrdersPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("order detail page renders", () => {
    const html = renderToString(<OrderDetailPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("checkout page renders", () => {
    const html = renderToString(<CheckoutPage />);
    expect(html.length).toBeGreaterThan(0);
  });
});
