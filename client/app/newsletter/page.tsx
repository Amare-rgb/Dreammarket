"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { api } from "@/lib/api";

interface NewsletterIssue {
  id: string;
  subject: string;
  previewText: string | null;
  publishedAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function NewsletterArchivePage() {
  const [issues, setIssues] = useState<NewsletterIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get("/api/media/newsletter/issues")
      .then((res) => {
        if (active) setIssues(res.data?.items || []);
      })
      .catch(() => {
        if (active) setIssues([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      {/* Edit Smarter blue header */}
      <section className="bg-[#1d4ed8] px-5 py-14 text-center text-white sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-200">
          Weekly Newsletter
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Edit Smarter
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-blue-100 sm:text-base">
          Media industry news, video releases, and the articles everyone is
          reading — delivered to your inbox every week.
        </p>
        <Link
          href="/articles"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold text-[#1d4ed8] transition hover:bg-blue-50"
        >
          <Mail size={16} /> Subscribe on Articles page
        </Link>
      </section>

      {/* Archive */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-xl font-bold text-slate-900">Past Newsletters</h2>
        {loading ? (
          <div className="flex justify-center py-16">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#1d4ed8]" />
          </div>
        ) : issues.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No newsletters published yet. Check back soon!
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {issues.map((issue) => (
              <li key={issue.id}>
                <Link
                  href={`/newsletter/${issue.id}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1d4ed8]/40 hover:shadow"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#1d4ed8]">
                      {formatDate(issue.publishedAt)}
                    </p>
                    <h3 className="mt-1 truncate text-base font-bold text-slate-900 group-hover:text-[#1d4ed8]">
                      {issue.subject}
                    </h3>
                    {issue.previewText && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {issue.previewText}
                      </p>
                    )}
                  </div>
                  <ArrowRight
                    size={18}
                    className="shrink-0 text-slate-300 transition group-hover:text-[#1d4ed8]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
