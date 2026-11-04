"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useLanguage } from "@/context/LanguageContext";

// API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m3 3 18 18" strokeLinecap="round" />
      <path
        d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 3.9M6.2 6.2C3.8 7.9 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const passwordsMatch =
    form.confirmPassword.length === 0 || form.password === form.confirmPassword;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.password !== form.confirmPassword) {
      setError(
        t("auth.register.error_passwords_mismatch", "Passwords do not match")
      );
      return;
    }

    if (form.password.length < 8) {
      setError(
        t(
          "auth.register.error_password_too_short",
          "Password must be at least 8 characters"
        )
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/api/auth/register", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });

      console.log("Registration response:", response.data);

      if (response.data.success) {
        setSuccess(
          t(
            "auth.register.success_message",
            "Account created successfully! Redirecting to sign in..."
          )
        );

        setForm({
          name: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
        });

        setTimeout(() => {
          router.push("/auth/signin");
        }, 2500);
      } else {
        setError(
          response.data.error ||
            t("auth.register.error_registration_failed", "Registration failed")
        );
      }
    } catch (err) {
      console.error("Registration error:", err);

      if (axios.isAxiosError(err)) {
        const errorMsg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          t(
            "auth.register.error_registration_generic",
            "Registration failed. Please try again."
          );
        setError(errorMsg);
      } else {
        setError(
          t(
            "auth.register.error_unexpected",
            "An unexpected error occurred. Please try again."
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--cream)]">
      {/* Background decoration */}
      <div
        className="pointer-events-none absolute -left-40 -top-32 h-80 w-80 rounded-full bg-[#e0a83c]/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#3a2a1e]/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Centered form */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-6">
        <div className="w-full overflow-hidden rounded-2xl border border-[#3a2a1e]/10 bg-white p-5 shadow-[0_20px_60px_rgba(58,42,30,.10)] sm:p-6">
          <div className="mb-5">
            <div className="mb-2 inline-flex rounded-full bg-[#faf6ee] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#b98a3e]">
              {t("auth.register.form_badge", "Create account")}
            </div>

            <h2 className="font-serif-heading text-2xl font-medium leading-tight tracking-[-0.035em] text-[#1a1410]">
              {t("auth.register.form_title", "Create your account.")}
            </h2>

            <p className="mt-1.5 text-xs leading-5 text-[#7a6a58]">
              {t(
                "auth.register.form_subtitle",
                "Create your account in a few simple steps and start exploring the digital marketplace."
              )}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-xs font-semibold text-[#1a1410]"
              >
                {t("auth.register.full_name", "Full name")}
              </label>

              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder={t(
                  "auth.register.full_name_placeholder",
                  "Enter your full name"
                )}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                className="h-10 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-3 text-xs text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-2 focus:ring-[#e0a83c]/20"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-semibold text-[#1a1410]"
              >
                {t("auth.register.email", "Email")}
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t(
                  "auth.register.email_placeholder",
                  "you@example.com"
                )}
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
                className="h-10 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-3 text-xs text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-2 focus:ring-[#e0a83c]/20"
              />
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-xs font-semibold text-[#1a1410]"
              >
                {t("auth.register.phone", "Phone number")}
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder={t(
                  "auth.register.phone_placeholder",
                  "+251 9XX XXX XXX"
                )}
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                required
                className="h-10 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-3 text-xs text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-2 focus:ring-[#e0a83c]/20"
              />
            </div>

            {/* Passwords */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-semibold text-[#1a1410]"
                >
                  {t("auth.register.password", "Password")}
                </label>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t(
                      "auth.register.password_placeholder",
                      "Create a password"
                    )}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    className="h-10 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-3 pr-10 text-xs text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-2 focus:ring-[#e0a83c]/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword
                        ? t("auth.register.hide_password", "Hide password")
                        : t("auth.register.show_password", "Show password")
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6a58] hover:text-[#1a1410]"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-xs font-semibold text-[#1a1410]"
                >
                  {t("auth.register.confirm_password", "Confirm password")}
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t(
                      "auth.register.confirm_password_placeholder",
                      "Repeat password"
                    )}
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    required
                    minLength={8}
                    aria-invalid={!passwordsMatch}
                    className={`h-10 w-full rounded-xl border bg-[#faf6ee]/60 px-3 pr-10 text-xs text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:bg-white focus:ring-2 focus:ring-[#e0a83c]/20 ${
                      passwordsMatch
                        ? "border-[#3a2a1e]/10 focus:border-[#b98a3e]"
                        : "border-red-400 focus:border-red-400"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={
                      showConfirmPassword
                        ? t(
                            "auth.register.hide_confirm_password",
                            "Hide confirm password"
                          )
                        : t(
                            "auth.register.show_confirm_password",
                            "Show confirm password"
                          )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6a58] hover:text-[#1a1410]"
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>

                {!passwordsMatch && (
                  <p className="mt-1 text-[10px] font-medium text-red-500">
                    {t(
                      "auth.register.passwords_do_not_match",
                      "Passwords do not match."
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Terms */}
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                required
                className="mt-0.5 h-3.5 w-3.5 rounded border-[#3a2a1e]/20 accent-[#b98a3e]"
              />

              <span className="text-[10px] leading-4 text-[#7a6a58]">
                {t("auth.register.terms_prefix", "I agree to the")}{" "}
                <Link
                  href="/terms"
                  className="font-semibold text-[#b98a3e] hover:text-[#1a1410]"
                >
                  {t("auth.register.terms_of_service", "Terms of Service")}
                </Link>{" "}
                {t("auth.register.terms_and", "and")}{" "}
                <Link
                  href="/privacy"
                  className="font-semibold text-[#b98a3e] hover:text-[#1a1410]"
                >
                  {t("auth.register.privacy_policy", "Privacy Policy")}
                </Link>
                {t("auth.register.terms_suffix", ".")}
              </span>
            </label>

            <button
              type="submit"
              disabled={!passwordsMatch || isLoading}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-[#EB6D3D] px-4 text-xs font-bold text-[#20283a] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf5427] hover:text-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#faf6ee] border-t-transparent" />
                  {t("auth.register.submitting", "Creating account...")}
                </>
              ) : (
                t("auth.register.submit", "Create my account")
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[#7a6a58]">
            {t(
              "auth.register.already_have_account",
              "Already have an account?"
            )}{" "}
            <Link
              href="/auth/signin"
              className="font-bold text-[#b98a3e] hover:text-[#1a1410]"
            >
              {t("auth.register.sign_in", "Sign in")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}