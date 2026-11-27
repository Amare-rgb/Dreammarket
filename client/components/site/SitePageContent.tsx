"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";

export interface SitePageLink {
  title: string;
  description?: string;
  url: string;
}
export interface SitePageData {
  slug: string;
  title: string;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  body?: string | null;
  links?: SitePageLink[];
}
export function SitePageContent({ slug }: { slug: string }) {
  const [page, setPage] = useState<SitePageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/pages/${slug}`)
      .then((res) => {
        if (!cancelled && res.data?.success) setPage(res.data.page);
      })
      .catch(() => {
        if (!cancelled) setError("This page could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-white">
        <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
      </main>
    );
  }

  if (error || !page) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-white px-4">
        <p className="text-slate-500">{error || "Page not found."}</p>
      </main>
    );
  }

  const links = (page.links || []).filter((l) => l.title && l.url);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="relative overflow-hidden bg-[#20283a] px-5 py-20 text-center text-white sm:py-24">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[#F47822]/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffad72]">
            {page.title}
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {page.heroTitle || page.title}
          </h1>
          {page.heroSubtitle && (
            <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
              {page.heroSubtitle}
            </p>
          )}
        </div>
      </section>

      {page.body && (
        <section className="px-5 py-14">
          <div className="mx-auto max-w-3xl whitespace-pre-line text-base leading-8 text-slate-600">
            {page.body}
          </div>
        </section>
      )}

      {links.length > 0 && (
        <section className="px-5 pb-20">
          <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link, i) => (
              <a
                key={`${link.url}-${i}`}
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#e0a83c]/60 hover:shadow-md"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#e86b25]">
                  <BookOpen size={22} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#d75e18]">
                  {link.title}
                </h3>
                {link.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {link.description}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#d75e18]">
                  Open <ArrowUpRight size={15} />
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {links.length === 0 && !page.body && (
        <section className="px-5 pb-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-slate-500">
              Content for this page is being prepared. Check back soon.
            </p>
            <Link
              href="/shop"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F47822] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#df6417]"
            >
              Browse products <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
