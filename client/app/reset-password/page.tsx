"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--cream)]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const token = searchParams.get("token") || "";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      setError("Use at least 8 characters and include at least one number.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to reset your password.");
      }
      setComplete(true);
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
          {t("auth.reset.title", "Set a new password")}
        </h1>
        {complete ? (
          <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
            {t(
              "auth.reset.complete",
              "Your password has been reset. You can now sign in with your new password."
            )}
          </div>
        ) : !token ? (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {t(
              "auth.reset.missing_token",
              "This reset link is missing its token. Request a new password reset link."
            )}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-[#667085]">
              {t(
                "auth.reset.description",
                "Choose a new password with at least 8 characters and one number."
              )}
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="newPassword" className="mb-1.5 block text-sm font-semibold text-[#20283a]">
                  {t("auth.reset.new_password", "New password")}
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  className="h-12 w-full rounded-xl border border-[#20283a]/15 px-4 text-sm outline-none focus:border-[#EB6D3D] focus:ring-4 focus:ring-[#EB6D3D]/15"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-semibold text-[#20283a]">
                  {t("auth.reset.confirm_password", "Confirm new password")}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  className="h-12 w-full rounded-xl border border-[#20283a]/15 px-4 text-sm outline-none focus:border-[#EB6D3D] focus:ring-4 focus:ring-[#EB6D3D]/15"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-xl bg-[#EB6D3D] px-4 text-sm font-bold text-[#20283a] transition-colors hover:bg-[#cf5427] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading
                  ? t("auth.reset.updating", "Updating...")
                  : t("auth.reset.submit", "Reset password")}
              </button>
            </form>
          </>
        )}
        <Link
          href={complete ? "/auth/signin" : "/forgot-password"}
          className="mt-6 inline-block text-sm font-semibold text-[#F47822] hover:text-[#cf5427]"
        >
          {complete
            ? t("auth.reset.signin", "Go to sign in")
            : t("auth.reset.request_another", "Request another reset link")}
        </Link>
      </section>
    </main>
  );
}
