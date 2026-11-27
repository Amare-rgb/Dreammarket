"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useLanguage } from "@/context/LanguageContext";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

const INITIAL_FORM = { name: "", email: "", phone: "", password: "", confirmPassword: "" };
const INPUT_BASE =
  "h-10 w-full rounded-xl border border-[#3a2a1e]/10 bg-[#faf6ee]/60 px-3 text-xs text-[#1a1410] outline-none transition placeholder:text-[#7a6a58]/60 focus:border-[#b98a3e] focus:bg-white focus:ring-2 focus:ring-[#e0a83c]/20";

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
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

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPwd, setShowPwd] = useState({ password: false, confirmPassword: false });
  const [status, setStatus] = useState<{ loading: boolean; error: string | null; success: string | null }>({
    loading: false,
    error: null,
    success: null,
  });

  const passwordsMatch = !form.confirmPassword || form.password === form.confirmPassword;
  const updateField = (key: keyof typeof INITIAL_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const textFields = [
    { key: "name" as const, type: "text", autoComplete: "name", label: t("auth.register.full_name", "Full name"), placeholder: t("auth.register.full_name_placeholder", "Enter your full name") },
    { key: "email" as const, type: "email", autoComplete: "email", label: t("auth.register.email", "Email"), placeholder: t("auth.register.email_placeholder", "you@example.com") },
    { key: "phone" as const, type: "tel", autoComplete: "tel", label: t("auth.register.phone", "Phone number"), placeholder: t("auth.register.phone_placeholder", "+251 9XX XXX XXX") },
  ];

  const passwordFields = [
    {
      key: "password" as const,
      label: t("auth.register.password", "Password"),
      placeholder: t("auth.register.password_placeholder", "Create a password"),
      toggleLabel: showPwd.password ? t("auth.register.hide_password", "Hide password") : t("auth.register.show_password", "Show password"),
    },
    {
      key: "confirmPassword" as const,
      label: t("auth.register.confirm_password", "Confirm password"),
      placeholder: t("auth.register.confirm_password_placeholder", "Repeat password"),
      toggleLabel: showPwd.confirmPassword ? t("auth.register.hide_confirm_password", "Hide confirm password") : t("auth.register.show_confirm_password", "Show confirm password"),
    },
  ];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      return setStatus({ loading: false, success: null, error: t("auth.register.error_passwords_mismatch", "Passwords do not match") });
    }
    if (form.password.length < 8) {
      return setStatus({ loading: false, success: null, error: t("auth.register.error_password_too_short", "Password must be at least 8 characters") });
    }

    setStatus({ loading: true, error: null, success: null });
    try {
      const { name, email, phone, password } = form;
      const { data } = await api.post("/api/auth/register", { name, email, phone, password });

      if (!data.success) {
        return setStatus({ loading: false, success: null, error: data.error || t("auth.register.error_registration_failed", "Registration failed") });
      }

      setForm(INITIAL_FORM);
      setStatus({ loading: false, error: null, success: t("auth.register.success_message", "Account created successfully! Redirecting to sign in...") });
      setTimeout(() => router.push("/auth/signin"), 2500);
    } catch (err) {
      const error = axios.isAxiosError(err)
        ? err.response?.data?.error || err.response?.data?.message || t("auth.register.error_registration_generic", "Registration failed. Please try again.")
        : t("auth.register.error_unexpected", "An unexpected error occurred. Please try again.");
      setStatus({ loading: false, success: null, error });
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--cream)]">
      <div className="pointer-events-none absolute -left-40 -top-32 h-80 w-80 rounded-full bg-[#e0a83c]/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#3a2a1e]/10 blur-3xl" aria-hidden="true" />

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
              {t("auth.register.form_subtitle", "Create your account in a few simple steps and start exploring the digital marketplace.")}
            </p>
          </div>

          {status.error && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">{status.error}</div>}
          {status.success && <div className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700">{status.success}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            {textFields.map(({ key, type, autoComplete, label, placeholder }) => (
              <div key={key}>
                <label htmlFor={key} className="mb-1 block text-xs font-semibold text-[#1a1410]">{label}</label>
                <input
                  id={key}
                  name={key}
                  type={type}
                  autoComplete={autoComplete}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  required
                  className={INPUT_BASE}
                />
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              {passwordFields.map(({ key, label, placeholder, toggleLabel }) => {
                const invalid = key === "confirmPassword" && !passwordsMatch;
                return (
                  <div key={key}>
                    <label htmlFor={key} className="mb-1 block text-xs font-semibold text-[#1a1410]">{label}</label>
                    <div className="relative">
                      <input
                        id={key}
                        name={key}
                        type={showPwd[key] ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(e) => updateField(key, e.target.value)}
                        required
                        minLength={8}
                        aria-invalid={invalid || undefined}
                        className={`${INPUT_BASE} pr-10 ${invalid ? "border-red-400 focus:border-red-400" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((prev) => ({ ...prev, [key]: !prev[key] }))}
                        aria-label={toggleLabel}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6a58] hover:text-[#1a1410]"
                      >
                        <EyeIcon open={showPwd[key]} />
                      </button>
                    </div>
                    {invalid && (
                      <p className="mt-1 text-[10px] font-medium text-red-500">
                        {t("auth.register.passwords_do_not_match", "Passwords do not match.")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" required className="mt-0.5 h-3.5 w-3.5 rounded border-[#3a2a1e]/20 accent-[#b98a3e]" />
              <span className="text-[10px] leading-4 text-[#7a6a58]">
                {t("auth.register.terms_prefix", "I agree to the")}{" "}
                <Link href="/terms" className="font-semibold text-[#b98a3e] hover:text-[#1a1410]">{t("auth.register.terms_of_service", "Terms of Service")}</Link>{" "}
                {t("auth.register.terms_and", "and")}{" "}
                <Link href="/privacy" className="font-semibold text-[#b98a3e] hover:text-[#1a1410]">{t("auth.register.privacy_policy", "Privacy Policy")}</Link>
                {t("auth.register.terms_suffix", ".")}
              </span>
            </label>

            <button
              type="submit"
              disabled={!passwordsMatch || status.loading}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-[#EB6D3D] px-4 text-xs font-bold text-[#20283a] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf5427] hover:text-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status.loading ? (
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
            {t("auth.register.already_have_account", "Already have an account?")}{" "}
            <Link href="/auth/signin" className="font-bold text-[#b98a3e] hover:text-[#1a1410]">
              {t("auth.register.sign_in", "Sign in")}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}