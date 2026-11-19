// Shared mock factories for page tests.
// vi.mock factories are hoisted, so each test file must call vi.mock()
// literally — but the factory may `await import()` this helper and return
// the module objects built here.
import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var __testParams: Record<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __testPathname: string | undefined;
  // eslint-disable-next-line no-var
  var __testSearch: string | undefined;
  // eslint-disable-next-line no-var
  var __testAuth: Record<string, unknown> | undefined;
}

export function resetTestGlobals() {
  globalThis.__testParams = {};
  globalThis.__testPathname = "/";
  globalThis.__testSearch = "";
  globalThis.__testAuth = {
    status: "authenticated",
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      phone: "+251911000000",
      role: "USER",
    },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  };
}

resetTestGlobals();

// ── next/navigation ──────────────────────────────────────────────
export function nextNavigation() {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => globalThis.__testPathname ?? "/",
    useParams: () => globalThis.__testParams ?? {},
    useSearchParams: () => new URLSearchParams(globalThis.__testSearch ?? ""),
    redirect: vi.fn(),
    notFound: vi.fn(),
    permanentRedirect: vi.fn(),
  };
}

// ── next/link ────────────────────────────────────────────────────
export function nextLink() {
  const Link = ({
    href,
    children,
    ...rest
  }: {
    href: unknown;
    children?: ReactNode;
    [key: string]: unknown;
  }) =>
    createElement(
      "a",
      { href: typeof href === "string" ? href : "#", ...rest },
      children
    );
  Link.displayName = "MockLink";
  return { default: Link };
}

// ── next/image ───────────────────────────────────────────────────
export function nextImage() {
  const NEXT_IMAGE_ONLY_PROPS = [
    "fill",
    "priority",
    "unoptimized",
    "placeholder",
    "blurDataURL",
    "loader",
    "quality",
    "sizes",
  ];
  const Image = ({
    src,
    alt,
    ...rest
  }: {
    src: unknown;
    alt?: string;
    [key: string]: unknown;
  }) => {
    const imgProps = { ...rest };
    for (const key of NEXT_IMAGE_ONLY_PROPS) delete imgProps[key];
    return createElement("img", {
      src: typeof src === "string" ? src : "",
      alt: alt ?? "",
      ...imgProps,
    });
  };
  Image.displayName = "MockImage";
  return { default: Image };
}

// ── @/app/providers (useAuth) ────────────────────────────────────
export function providersModule() {
  return {
    useAuth: () => globalThis.__testAuth,
    Providers: ({ children }: { children?: ReactNode }) => children,
  };
}

// ── @/lib/api ────────────────────────────────────────────────────
export function apiModule() {
  const ok = { data: {} };
  const api = {
    get: vi.fn().mockResolvedValue(ok),
    post: vi.fn().mockResolvedValue(ok),
    put: vi.fn().mockResolvedValue(ok),
    patch: vi.fn().mockResolvedValue(ok),
    delete: vi.fn().mockResolvedValue(ok),
    defaults: {},
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  const uploadApi = new Proxy(
    {},
    {
      get: () =>
        vi.fn().mockResolvedValue({ success: true, url: "https://example.com/f.png" }),
    }
  );
  return { api, uploadApi, API_URL: "http://localhost:5000", default: api };
}

// ── axios ────────────────────────────────────────────────────────
export function axiosModule() {
  const instance = () => ({
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    defaults: {},
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  });
  return {
    default: {
      create: vi.fn(instance),
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
      isAxiosError: vi.fn(() => false),
    },
  };
}

// ── react-hot-toast ──────────────────────────────────────────────
export function toastModule() {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  });
  return { default: toast, toast };
}
