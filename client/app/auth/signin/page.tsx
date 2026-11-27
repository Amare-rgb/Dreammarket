"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const ROLE_ROUTES: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  SELLER: "/seller/dashboard",
  FARMER: "/seller/dashboard",
};

type AuthUser = { role?: string } & Record<string, unknown>;
type AuthPayload = { token?: string; user?: AuthUser; error?: string; message?: string; success?: boolean };

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      {open ? (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      ) : (
        <>
          <path d="m3 3 18 18" strokeLinecap="round" />
          <path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 3.9M6.2 6.2C3.8 7.9 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-4">
      <div className="h-px flex-1 bg-[#3a2a1e]/10" />
      <span className="text-xs text-[#7a6a58]">{label}</span>
      <div className="h-px flex-1 bg-[#3a2a1e]/10" />
    </div>
  );
}

async function parseAuthResponse(res: Response, fallbackMsg: string): Promise<AuthPayload> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as AuthPayload;
  } catch {
    throw new Error(fallbackMsg);
  }
}

export default function SignInPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleInitialized = useRef(false);

  const completeSignIn = useCallback(
    (data: AuthPayload) => {
      const stores = [localStorage, sessionStorage];
      if (data.token) {
        stores.forEach((s) => {
          s.setItem("authToken", data.token!);
          s.setItem("token", data.token!);
        });
      }

      if (data.user) {
        const serialized = JSON.stringify(data.user);
        stores.forEach((s) => s.setItem("user", serialized));
        if (data.user.role) {
          const roleUpper = data.user.role.toUpperCase();
          stores.forEach((s) => s.setItem("userRole", roleUpper));
        }
      }

      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("auth-change"));

      const role = data.user?.role?.toUpperCase() || localStorage.getItem("userRole") || "USER";
      const redirectUrl = ROLE_ROUTES[role] ?? "/shop";
      const requestedRedirect = new URLSearchParams(window.location.search).get("redirectTo");

      setTimeout(() => {
        router.replace(requestedRedirect === "/contact" ? requestedRedirect : redirectUrl);
      }, 0);
    },
    [router]
  );

  const handleGoogleCredential = useCallback(
    async (response: { credential?: string }) => {
      const fallbackErr = t("auth.signin.error_google_failed", "Google login failed. Please try again.");
      if (!response?.credential) return setError(fallbackErr);

      setError(null);
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });

        const data = await parseAuthResponse(
          res,
          t("auth.signin.error_server_response", "Server returned invalid response. Please check backend is running.")
        );

        if (!res.ok || !data.success) {
          throw new Error(data.error || fallbackErr);
        }
        completeSignIn(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackErr);
      } finally {
        setIsLoading(false);
      }
    },
    [completeSignIn, t]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current || googleInitialized.current) return;

    type GoogleIdApi = {
      initialize: (cfg: { client_id: string; callback: (res: { credential?: string }) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
    const getGoogleId = () =>
      (window as unknown as { google?: { accounts?: { id?: GoogleIdApi } } }).google?.accounts?.id;

    const initGoogle = () => {
      const googleId = getGoogleId();
      if (!googleId || !googleBtnRef.current || googleInitialized.current) return;

      googleInitialized.current = true;
      googleId.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      googleId.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: Math.min(googleBtnRef.current.offsetWidth || 300, 400),
        text: "continue_with",
        shape: "pill",
      });
    };

    if (getGoogleId()) return initGoogle();

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [handleGoogleCredential]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return setError(t("auth.signin.error_fill_all", "Please fill in all fields."));
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setError(t("auth.signin.error_invalid_email", "Please enter a valid email address."));
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await parseAuthResponse(
        res,
        t("auth.signin.error_server_response", "Server returned invalid response. Please check backend is running.")
      );

      if (!res.ok) {
        const statusMessages: Record<number, string> = {
          401: t("auth.signin.error_invalid_credentials", "Invalid credentials. Please check your email and password."),
          400: t("auth.signin.error_missing_fields", "Email and password are required."),
          403: t("auth.signin.error_access_denied", "Access denied. Admin privileges required."),
          404: t("auth.signin.error_user_not_found", "User not found. Please check your email."),
        };
        throw new Error(
          data.error ||
            statusMessages[res.status] ||
            data.message ||
            t("auth.signin.error_login_failed", `Login failed (Status: ${res.status}).`)
        );
      }

      if (!data.success) {
        throw new Error(data.error || t("auth.signin.error_login_failed", "Login failed. Please try again."));
      }

      completeSignIn(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.signin.error_generic", "An error occurred. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[var(--cream)]">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#e0a83c]/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 h-[32rem] w-[32rem] rounded-full bg-[#3a2a1e]/10 blur-3xl" aria-hidden="true" />

      <section className="relative flex min-h-screen flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border border-[#3a2a1e]/10 bg-white p-6 shadow-[0_25px_70px_rgba(58,42,30,.10)] sm:p-8">
            <div className="mb-6">
              <div className="mb-3 inline-flex rounded-full bg-[#faf6ee] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b98a3e]">
                {t("auth.signin.form_badge", "Welcome back")}
              </div>
              <h2 className="font-serif-heading text-3xl font-medium tracking-[-0.035em] text-[#1a1410]">
                {t("auth.signin.form_title", "Sign in")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#7a6a58]">
                {t("auth.signin.form_subtitle", "Access your account and continue shopping.")}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#1a1410]">
                  {t("auth.signin.email", "Email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth.signin.email_placeholder", "admin@example.com")}
                  required
                  disabled={isLoading}
                  className="h-12 w-full rounded-2xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-4 text-sm text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-4 focus:ring-[#e0a83c]/20 disabled:opacity-60"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-[#1a1410]">
                    {t("auth.signin.password", "Password")}
                  </label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-[#F47822] transition-colors hover:text-[#cf5427]">
                    {t("auth.signin.forgot_password", "Forgot password?")}
                  </Link>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t("auth.signin.password_placeholder", "Enter your password")}
                    required
                    disabled={isLoading}
                    className="h-12 w-full rounded-2xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-4 pr-12 text-sm text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-4 focus:ring-[#e0a83c]/20 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t("auth.signin.hide_password", "Hide password") : t("auth.signin.show_password", "Show password")}
                    disabled={isLoading}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a6a58] transition-colors hover:text-[#1a1410] disabled:opacity-50"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-[#3a2a1e]/20 accent-[#b98a3e] disabled:opacity-50"
                />
                <span className="text-sm text-[#7a6a58]">{t("auth.signin.remember_me", "Remember me")}</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#EB6D3D] px-5 text-sm font-bold text-[#20283a] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf5427] hover:text-white hover:shadow-lg disabled:opacity-70 disabled:hover:-translate-y-0 disabled:hover:shadow-none"
              >
                {isLoading ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t("auth.signin.submitting", "Signing in...")}
                  </>
                ) : (
                  t("auth.signin.submit", "Sign in to your account")
                )}
              </button>
            </form>

            <div className="mt-5">
              <div className="mb-3 flex items-center gap-4">
                <div className="h-px flex-1 bg-[#3a2a1e]/10" />
                <span className="text-xs text-[#7a6a58]">{t("auth.signin.or_continue_with", "or continue with")}</span>
                <div className="h-px flex-1 bg-[#3a2a1e]/10" />
              </div>
              <div ref={googleBtnRef} className="flex min-h-[44px] items-center justify-center">
                {!GOOGLE_CLIENT_ID && (
                  <span className="text-xs text-red-500">
                    Google login not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID)
                  </span>
                )}
              </div>
            </div>

            <Divider label={t("auth.signin.or", "OR")} />

            <p className="text-center text-sm text-[#7a6a58]">
              {t("auth.signin.no_account", "Don't have an account?")}{" "}
              <Link href="/auth/register" className="font-bold text-[#b98a3e] hover:text-[#1a1410]">
                {t("auth.signin.create_one", "Create one")}
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-[#7a6a58]">
            {t("auth.signin.terms_notice", "By continuing, you agree to our")}{" "}
            <Link href="/terms" className="font-semibold text-[#b98a3e] hover:text-[#1a1410]">
              {t("auth.signin.terms", "Terms")}
            </Link>{" "}
            {t("auth.signin.terms_and", "and")}{" "}
            <Link href="/privacy" className="font-semibold text-[#b98a3e] hover:text-[#1a1410]">
              {t("auth.signin.privacy_policy", "Privacy Policy")}
            </Link>
            {t("auth.signin.terms_suffix", ".")}
          </p>
        </div>
      </section>
    </main>
  );
}