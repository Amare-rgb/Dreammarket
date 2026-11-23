"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .get("/api/media/newsletter/unsubscribe", { params: { token } })
        .then((res) => {
          if (cancelled) return;
          setState("done");
          setMessage(res.data?.message || "You have been unsubscribed.");
        })
        .catch((err) => {
          if (cancelled) return;
          setState("error");
          setMessage(
            (err as { response?: { data?: { error?: string } } })?.response?.data
              ?.error || "Unsubscribe failed."
          );
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-[#f7f4ef] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        {state === "loading" && (
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#F47822]" />
        )}
        <h1 className="mt-3 text-xl font-bold text-slate-900">
          {state === "done" ? "Unsubscribed" : state === "error" ? "Something went wrong" : "Processing…"}
        </h1>
        {state !== "loading" && (
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        )}
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center bg-[#f7f4ef]">
          <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
        </main>
      }
    >
      <UnsubscribeInner />
    </Suspense>
  );
}
