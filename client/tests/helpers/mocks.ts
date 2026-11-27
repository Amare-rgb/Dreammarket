import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

declare global {
  var __testParams: Record<string, string> | undefined;
  var __testPathname: string | undefined;
  var __testSearch: string | undefined;
  var __testAuth: Record<string, unknown> | undefined;
}

const NEXT_IMAGE_PROPS = new Set([
  "fill",
  "priority",
  "unoptimized",
  "placeholder",
  "blurDataURL",
  "loader",
  "quality",
  "sizes",
  "fetchPriority",
]);

function makeClient() {
  const ok = { data: {} };
  return {
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
}

export function resetTestGlobals() {
  globalThis.__testParams = {};
  globalThis.__testPathname = "/";
  globalThis.__testSearch = "";
  globalThis.__testAuth = {
    status: "authenticated",
    user: { id: "user-1", name: "Test User", email: "test@example.com", phone: "+251911000000", role: "USER" },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  };
}

resetTestGlobals();

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

export function nextLink() {
  const Link = ({ href, children, ...rest }: { href: unknown; children?: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children);
  Link.displayName = "MockLink";
  return { default: Link };
}

export function nextImage() {
  const Image = ({ src, alt, ...rest }: { src: unknown; alt?: string; [key: string]: unknown }) => {
    const imgProps = Object.fromEntries(Object.entries(rest).filter(([k]) => !NEXT_IMAGE_PROPS.has(k)));
    return createElement("img", { src: typeof src === "string" ? src : "", alt: alt ?? "", ...imgProps });
  };
  Image.displayName = "MockImage";
  return { default: Image };
}

export function providersModule() {
  return {
    useAuth: () => globalThis.__testAuth,
    Providers: ({ children }: { children?: ReactNode }) => children,
  };
}

export function apiModule() {
  const api = makeClient();
  const uploadApi = new Proxy({}, { get: () => vi.fn().mockResolvedValue({ success: true, url: "https://example.com/f.png" }) });
  return { api, uploadApi, API_URL: "http://localhost:5000", default: api };
}

export function axiosModule() {
  const base = makeClient();
  return {
    default: {
      ...base,
      create: vi.fn(() => makeClient()),
      isAxiosError: vi.fn(() => false),
    },
  };
}

export function toastModule() {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  });
  return { default: toast, toast };
}