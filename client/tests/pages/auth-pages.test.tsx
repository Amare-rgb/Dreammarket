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

import SignInPage from "../../app/auth/signin/page";
import RegisterPage from "../../app/auth/register/page";
import ForgotPasswordPage from "../../app/forgot-password/page";
import ResetPasswordPage from "../../app/reset-password/page";
describe("auth pages", () => {
  it("sign-in page renders", () => {
    const html = renderToString(<SignInPage />);
    expect(html.length).toBeGreaterThan(0);
  });
  it("register page renders", () => {
    const html = renderToString(<RegisterPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("forgot-password page renders", () => {
    const html = renderToString(<ForgotPasswordPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("reset-password page renders", () => {
    const html = renderToString(<ResetPasswordPage />);
    expect(html.length).toBeGreaterThan(0);
  });
});
