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
vi.mock("axios", async () => {
  const m = await import("../helpers/mocks");
  return m.axiosModule();
});
vi.mock("react-hot-toast", async () => {
  const m = await import("../helpers/mocks");
  return m.toastModule();
});
import AdminDashboardPage from "../../app/admin/dashboard/page";
import AdminProductsPage from "../../app/admin/products/page";
import AdminProductNewPage from "../../app/admin/products/new/page";
import AdminProductDetailPage from "../../app/admin/products/[id]/page";
import AdminProductEditPage from "../../app/admin/products/[id]/edit/page";
import AdminOrdersPage from "../../app/admin/orders/page";
import AdminUsersPage from "../../app/admin/users/page";
import AdminSettingsPage from "../../app/admin/settings/page";
import AdminRewardsPage from "../../app/admin/rewards/page";
import AdminDeliveryPage from "../../app/admin/delivery/page";
import AdminFeedbackPage from "../../app/admin/feedback/page";
import AdminProfilePage from "../../app/admin/profile/page";
import AdminArticlesPage from "../../app/admin/articles/page";
import AdminArticleCategoriesPage from "../../app/admin/articles/categories/page";
import AdminArticleNewNotePage from "../../app/admin/articles/new/note/page";
import AdminArticleNewVideoPage from "../../app/admin/articles/new/video/page";
import AdminArticleEditPage from "../../app/admin/articles/[id]/edit/page";
describe("admin pages", () => {
  it("dashboard renders", () => {
    expect(renderToString(<AdminDashboardPage />).length).toBeGreaterThan(0);
  });
  it("products list renders", () => {
    expect(renderToString(<AdminProductsPage />).length).toBeGreaterThan(0);
  });
  it("product create renders", () => {
    expect(renderToString(<AdminProductNewPage />).length).toBeGreaterThan(0);
  })
  it("product detail renders", () => {
    const params = {
      status: "fulfilled",
      value: { id: "prod-1" },
      then: () => {},
    } as unknown as Promise<{ id: string }>;
    const html = renderToString(
      <AdminProductDetailPage params={params} />
    );
    expect(html.length).toBeGreaterThan(0);
  });
  it("product edit renders", () => {
    const params = {
      status: "fulfilled",
      value: { id: "prod-1" },
      then: () => {},
    } as unknown as Promise<{ id: string }>;
    const html = renderToString(
      <AdminProductEditPage params={params} />
    );
    expect(html.length).toBeGreaterThan(0);
  });
  it("orders renders", () => {
    expect(renderToString(<AdminOrdersPage />).length).toBeGreaterThan(0);
  });
  it("users renders", () => {
    expect(renderToString(<AdminUsersPage />).length).toBeGreaterThan(0);
  });
  it("settings renders", () => {
    expect(renderToString(<AdminSettingsPage />).length).toBeGreaterThan(0);
  });
  it("rewards renders", () => {
    expect(renderToString(<AdminRewardsPage />).length).toBeGreaterThan(0);
  });
  it("delivery renders", () => {
    expect(renderToString(<AdminDeliveryPage />).length).toBeGreaterThan(0);
  });
  it("feedback renders", () => {
    expect(renderToString(<AdminFeedbackPage />).length).toBeGreaterThan(0);
  });
  it("profile renders", () => {
    expect(renderToString(<AdminProfilePage />).length).toBeGreaterThan(0);
  });
  it("articles list renders", () => {
    expect(renderToString(<AdminArticlesPage />).length).toBeGreaterThan(0);
  });
  it("article categories renders", () => {
    expect(renderToString(<AdminArticleCategoriesPage />).length).toBeGreaterThan(0);
  });
  it("article new (note) renders", () => {
    expect(renderToString(<AdminArticleNewNotePage />).length).toBeGreaterThan(0);
  });
  it("article new (video) renders", () => {
    expect(renderToString(<AdminArticleNewVideoPage />).length).toBeGreaterThan(0);
  });
  it("article edit renders", () => {
    expect(() => AdminArticleEditPage()).not.toThrow();
  });
});
