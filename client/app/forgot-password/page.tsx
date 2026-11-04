"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to process your request.");
      }
      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the server. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--cream)] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#20283a]/10 bg-white p-6 shadow-xl sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F47822]">
          Dream More Affiliate Market
        </p>
        <h1 className="text-2xl font-semibold text-[#20283a]">
          {t("auth.forgot.title", "Forgot your password?")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          {t(
            "auth.forgot.description",
            "Enter your account email and we’ll send a secure password reset link."
          )}
        </p>

        {sent ? (
          <div role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
            {t(
              "auth.forgot.sent",
              "If an account exists for that email, password reset instructions have been sent. Please check your inbox."
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#20283a]">
                {t("auth.forgot.email", "Email address")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                className="h-12 w-full rounded-xl border border-[#20283a]/15 px-4 text-sm outline-none focus:border-[#EB6D3D] focus:ring-4 focus:ring-[#EB6D3D]/15"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-xl bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] transition-colors hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? t("auth.forgot.sending", "Sending...")
                : t("auth.forgot.submit", "Send reset link")}
            </button>
          </form>
        )}

        <Link href="/auth/signin" className="mt-6 inline-block text-sm font-semibold text-[#F47822] hover:text-[#cf5427]">
          {t("auth.forgot.back", "Back to sign in")}
        </Link>
      </section>
    </main>
  );
}
