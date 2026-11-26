"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Code2, LoaderCircle, Mail, Scissors, Video } from "lucide-react";
import { api } from "@/lib/api";
import {
  CAPCUT_REG_URL,
  VSCODE_DOWNLOAD_URL,
  launchCapCut,
  launchVsCode,
} from "@/lib/launchers";

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
  const [launchHint, setLaunchHint] = useState<"vscode" | "capcut" | null>(null);
  const [launching, setLaunching] = useState<"vscode" | "capcut" | null>(null);

  const handleVsEdit = async () => {
    setLaunching("vscode");
    setLaunchHint(null);
    const opened = await launchVsCode();
    setLaunching(null);
    if (!opened) setLaunchHint("vscode");
  };

  const handleVideoEdit = () => {
    setLaunchHint(null);
    setLaunching("capcut");
    launchCapCut();
    // Give the OS protocol dialog a moment, then show the .reg hint
    setTimeout(() => {
      setLaunching(null);
      setLaunchHint("capcut");
    }, 1500);
  };

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

        {/* Smart Edit tools: VS Edit (VS Code) + Video Edit (CapCut) */}
        <div className="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void handleVsEdit()}
            disabled={launching === "vscode"}
            className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60"
          >
            {launching === "vscode" ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Code2 size={15} />
            )}
            VS Edit
          </button>
          <button
            type="button"
            onClick={handleVideoEdit}
            disabled={launching === "capcut"}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#1d4ed8] transition hover:bg-blue-50 disabled:opacity-60"
          >
            {launching === "capcut" ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Video size={15} />
            )}
            Video Edit
          </button>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-200">
            <Scissors size={12} /> Smart cuts + captions
          </span>
        </div>

        {/* Fallback hints when the protocol handler is missing */}
        {launchHint === "vscode" && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-amber-300/50 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
            VS Code didn&apos;t open — it may not be installed.{" "}
            <a
              href={VSCODE_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              Download VS Code
            </a>{" "}
            and try again.
          </p>
        )}
        {launchHint === "capcut" && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-amber-300/50 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
            CapCut didn&apos;t open? Register the{" "}
            <code className="rounded bg-black/20 px-1">capcut://</code> protocol
            once:{" "}
            <a
              href={CAPCUT_REG_URL}
              download
              className="font-bold underline"
            >
              download capcut-protocol.reg
            </a>
            , right-click → Merge, then click Video Edit again.
          </p>
        )}
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
