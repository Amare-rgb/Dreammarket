import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, API_URL } from "../../app/lib/api";

/**
 * Integration test for the shared axios client: verifies base URL
 * normalization and that the auth interceptor attaches the stored token.
 */

const store = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
});
vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => store.get(`session:${key}`) ?? null,
  setItem: (key: string, value: string) =>
    void store.set(`session:${key}`, String(value)),
  removeItem: (key: string) => void store.delete(`session:${key}`),
  clear: () => store.clear(),
});
vi.stubGlobal("window", { dispatchEvent: () => true });

// Capture the final request config instead of hitting the network
let lastConfig: { headers?: Record<string, unknown>; url?: string } | null =
  null;

beforeEach(() => {
  store.clear();
  lastConfig = null;
  api.defaults.adapter = async (config) => {
    lastConfig = {
      headers: config.headers as Record<string, unknown>,
      url: config.url,
    };
    return {
      data: { ok: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
});

describe("api client", () => {
  it("exposes a normalized base URL without trailing slash or /api", () => {
    expect(API_URL).not.toMatch(/\/+$/);
    expect(API_URL).not.toMatch(/\/api$/i);
    expect(api.defaults.baseURL).toBe(API_URL);
  });

  it("attaches the Bearer token from localStorage", async () => {
    store.set("authToken", "test-jwt-token");
    await api.get("/api/orders");

    expect(lastConfig?.headers?.Authorization).toBe("Bearer test-jwt-token");
  });

  it("falls back to sessionStorage when localStorage has no token", async () => {
    store.set("session:authToken", "session-jwt");
    await api.get("/api/orders");

    expect(lastConfig?.headers?.Authorization).toBe("Bearer session-jwt");
  });

  it("sends no Authorization header when no token is stored", async () => {
    await api.get("/api/orders");
    expect(lastConfig?.headers?.Authorization).toBeUndefined();
  });
});
