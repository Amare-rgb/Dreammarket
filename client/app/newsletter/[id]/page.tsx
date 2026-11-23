"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";

interface NewsletterIssue {
  id: string;
  subject: string;
  previewText: string | null;
  body: string;
  publishedAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function NewsletterIssuePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [issue, setIssue] = useState<NewsletterIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get(`/api/media/newsletter/issues/${encodeURIComponent(id)}`)
      .then((res) => {
        if (active) setIssue(res.data?.item || null);
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#f8fafc]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#1d4ed8]" />
      </main>
    );
  }

  if (notFound || !issue) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#f8fafc] px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Newsletter not found</h1>
        <Link href="/newsletter" className="text-sm font-semibold text-[#1d4ed8] hover:underline">
          ← Back to past newsletters
        </Link>
      </main>
    );
  }

  const paragraphs = issue.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      {/* Blue header */}
      <section className="bg-[#1d4ed8] px-5 py-10 text-center text-white">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-200">
          Edit Smarter · {formatDate(issue.publishedAt)}
        </p>
        <h1 className="mx-auto mt-2 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          {issue.subject}
        </h1>
        {issue.previewText && (
          <p className="mx-auto mt-3 max-w-2xl text-sm text-blue-100">
            {issue.previewText}
          </p>
        )}
      </section>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/newsletter"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1d4ed8] hover:underline"
        >
          <ArrowLeft size={15} /> All newsletters
        </Link>
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-wrap text-base leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
        </div>
      </article>
    </main>
  );
}
