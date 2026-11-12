import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the NextAuth credentials provider and JWT/session callbacks
 * in app/lib/auth.ts. The module throws at import time without a valid
 * NEXTAUTH_SECRET, so the env var is set before the dynamic import.
 */

process.env.NEXTAUTH_SECRET = "test-nextauth-secret-that-is-long-enough";
process.env.NEXT_PUBLIC_API_URL = "http://localhost:5000";

const { authOptions } = await import("../../app/lib/auth");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const provider = authOptions.providers[0] as any;
// next-auth may keep the raw authorize under provider.options
const authorizeFn =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (provider.options?.authorize ?? provider.authorize) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { jwt, session } = authOptions.callbacks as any;

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const okLoginResponse = {
  ok: true,
  json: async () => ({
    success: true,
    user: {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "user",
      avatar: "https://example.com/a.png",
      phone: "+251900000000",
    },
  }),
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe("credentials authorize", () => {
  it("exposes an authorize function", () => {
    expect(typeof authorizeFn).toBe("function");
  });

  it("returns null when credentials are missing", async () => {
    expect(await authorizeFn({}, {})).toBeNull();
    expect(await authorizeFn({ email: "a@b.com" }, {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs in and normalizes the user (lowercase email, uppercase role)", async () => {
    fetchMock.mockResolvedValue(okLoginResponse);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const user = await authorizeFn(
      { email: "  ALICE@EXAMPLE.COM ", password: "secret" },
      {}
    );

    // fetch must have been intercepted — if not, a real request hit the backend
    expect(fetchMock, "fetch was not called — mock not applied").toHaveBeenCalled();
    // Surface the error authorize() swallows if login unexpectedly fails
    expect(user, JSON.stringify(errorSpy.mock.calls)).not.toBeNull();
    errorSpy.mockRestore();
    expect(user.id).toBe("user-1");
    expect(user.role).toBe("USER");
    expect(user.phone).toBe("+251900000000");

    // email is trimmed + lowercased before sending to the backend
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe("alice@example.com");
    expect(body.password).toBe("secret");
  });
  it("returns null when the backend rejects the login", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(
      await authorizeFn({ email: "a@b.com", password: "x" }, {})
    ).toBeNull();
  });

  it("returns null when the response is not successful", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });
    expect(
      await authorizeFn({ email: "a@b.com", password: "x" }, {})
    ).toBeNull();
  });

  it("returns null when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await authorizeFn({ email: "a@b.com", password: "x" }, {})
    ).toBeNull();
    errorSpy.mockRestore();
  });
});

describe("jwt callback", () => {
  it("copies user fields into the token on sign-in", async () => {
    const token = await jwt({
      token: {},
      user: {
        id: "user-1",
        role: "ADMIN",
        email: "admin@example.com",
        name: "Admin",
        phone: "+251911111111",
      },
    });
    expect(token.id).toBe("user-1");
    expect(token.role).toBe("ADMIN");
    expect(token.email).toBe("admin@example.com");
    expect(token.phone).toBe("+251911111111");
  });

  it("returns the token unchanged when there is no user", async () => {
    const existing = { id: "user-1", role: "USER" };
    const token = await jwt({ token: existing, user: undefined });
    expect(token).toBe(existing);
  });
});

describe("session callback", () => {
  it("maps token fields onto the session user", async () => {
    const result = await session({
      session: { user: {} },
      token: {
        id: "user-1",
        role: "SELLER",
        email: "seller@example.com",
        name: "Seller",
        phone: "+251922222222",
      },
    });
    expect(result.user.id).toBe("user-1");
    expect(result.user.role).toBe("SELLER");
    expect(result.user.email).toBe("seller@example.com");
    expect(result.user.phone).toBe("+251922222222");
  });
});
