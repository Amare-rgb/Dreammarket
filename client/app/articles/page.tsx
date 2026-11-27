"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Play, Search } from "lucide-react";
import { api } from "@/lib/api";
import ArticleSidebar from "@/components/articles/ArticleSidebar";
import { useLanguage } from "@/context/LanguageContext";
import { ArticleSummary, PublicCategory, categoryName, formatDate, localizedDescription, localizedTitle } from "@/lib/publicArticles";

const LOGO_SRC = "/banners/photo.jpg";
const HERO_VIDEO_SRCS = ["/banners/articl1.mp4", "/banners/articl2.mp4", "/banners/articl3.mp4"];

const youtubeThumbnail = (videoUrl: string) => {
  const match = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
};
const articleThumb = (a: ArticleSummary) => a.image || (a.videoUrl ? youtubeThumbnail(a.videoUrl) : null);

const LogoPlaceholder = ({ className = "", size = 64 }: { className?: string; size?: number }) => (
  <div className={`flex items-center justify-center bg-gradient-to-br from-[#EB6D3D]/10 to-slate-100 ${className}`}>
    <Image src={LOGO_SRC} alt="Dream More" width={size * 2} height={size * 2} unoptimized className="object-contain opacity-90" style={{ width: size, height: size }} />
  </div>
);

const PlayBadge = ({ size = 18, big = false }: { size?: number; big?: boolean }) => (
  <span className={big ? "absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 shadow-xl transition group-hover:scale-110" : "absolute inset-0 flex items-center justify-center"}>
    <span className={big ? "flex h-full w-full items-center justify-center" : "flex h-11 w-11 items-center justify-center rounded-full bg-red-600 shadow-lg transition group-hover:scale-110"}>
      <Play size={size} className="ml-0.5 text-white" fill="white" />
    </span>
  </span>
);

function ArticlesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  const activeCategory = searchParams.get("category") || "all";
  const urlSearch = searchParams.get("search") || "";
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState<string | null>(null);
  const query = searchInput !== null ? searchInput : urlSearch;
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [nlForm, setNlForm] = useState({ firstName: "", lastName: "", email: "", website: "" });
  const [nlTypes, setNlTypes] = useState<string[]>(["edit-smarter"]);
  const [nlSubmitting, setNlSubmitting] = useState(false);
  const [nlMessage, setNlMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const toggleNlType = (value: string) => setNlTypes((prev) => prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]);

  const subscribeNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    setNlMessage(null);
    if (!nlForm.firstName.trim() || !nlForm.lastName.trim() || !nlForm.email.trim()) { setNlMessage({ ok: false, text: "Please fill in all fields." }); return; }
    if (nlTypes.length === 0) { setNlMessage({ ok: false, text: "Select at least one newsletter." }); return; }
    setNlSubmitting(true);
    try {
      await api.post("/api/media/newsletter/subscribe", { firstName: nlForm.firstName, lastName: nlForm.lastName, email: nlForm.email, types: nlTypes, website: nlForm.website });
      setNlMessage({ ok: true, text: "Subscribed! Check your inbox for confirmation." });
      setNlForm({ firstName: "", lastName: "", email: "", website: "" });
      setNlTypes(["edit-smarter"]);
    } catch (err) {
      setNlMessage({ ok: false, text: (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Subscription failed. Please try again." });
    } finally { setNlSubmitting(false); }
  };

  useEffect(() => {
    let active = true;
    api.get("/api/articles/categories").then((res) => { if (active) setCategories(res.data?.categories || []); }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = activeCategory === "all" ? "" : `?category=${encodeURIComponent(activeCategory)}`;
    api.get(`/api/articles${params}`).then((res) => {
      if (!active) return;
      setArticles(res.data?.articles || []); setError("");
    }).catch(() => { if (active) setError(t("articles.articles_load_failed", "Articles could not be loaded. Please try again later.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeCategory, t]);

  const pushQuery = (slug: string, q: string) => {
    const params = new URLSearchParams();
    if (slug !== "all") params.set("category", slug);
    if (q) params.set("search", q);
    const qs = params.toString();
    router.push(`/articles${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const chooseCategory = (slug: string) => {
    if (slug === activeCategory) return;
    setLoading(true); setSearchInput(null); pushQuery(slug, urlSearch);
  };

  const handleInlineSearch = (e: React.FormEvent) => { e.preventDefault(); pushQuery(activeCategory, query.trim()); };

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);
  const q = urlSearch.trim().toLowerCase();
const filtered = !q
  ? articles
  : articles.filter((a) => {
      const title = (a.title ?? "").toLowerCase();
      const description = (a.description ?? "").toLowerCase();
      const titleAm = (a.titleAm ?? "").toLowerCase();
      const descriptionAm = (a.descriptionAm ?? "").toLowerCase();

      return (
        title.includes(q) ||
        description.includes(q) ||
        titleAm.includes(q) ||
        descriptionAm.includes(q)
      );
    });
  const showFeatured = !urlSearch.trim() && filtered.length > 0;
  const activeName = activeCategory === "all" ? "All articles" : categoryName(categories, activeCategory, language);

  const catBtn = (slug: string, label: string, count: number) => (
    <li key={slug}>
      <button type="button" onClick={() => chooseCategory(slug)} aria-current={activeCategory === slug ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === slug ? "bg-[#20283a] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
        {label} <span className="ml-1 opacity-70">{count}</span>
      </button>
    </li>
  );

  const featuredText = (a: ArticleSummary) => (
    <article key={a.id} className="group py-5 first:pt-0 last:pb-0">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#cf5427]">{categoryName(categories, a.category, language)}</p>
      <h3 className="mt-1.5 text-xl font-bold leading-snug text-slate-900 transition group-hover:text-[#cf5427] sm:text-2xl"><Link href={`/articles/${a.slug}`}>{localizedTitle(a, language)}</Link></h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{localizedDescription(a, language)}</p>
      <p className="mt-2 text-xs text-slate-400">{formatDate(a.createdAt)}</p>
    </article>
  );

  const gridCard = (article: ArticleSummary) => {
    const thumb = articleThumb(article);
    return (
      <article key={article.id} className="group flex h-full flex-col border border-slate-200 bg-white">
        <Link href={`/articles/${article.slug}`} className="relative block aspect-video w-full overflow-hidden bg-slate-100">
          {thumb ? <Image src={thumb} alt="" fill unoptimized className="object-cover transition duration-300 group-hover:scale-[1.03]" /> : <LogoPlaceholder className="h-full w-full" size={64} />}
          {article.videoUrl && <PlayBadge size={18} />}
        </Link>
        <div className="flex flex-1 flex-col p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#cf5427]">{categoryName(categories, article.category, language)}</p>
          <h3 className="mt-1.5 text-base font-bold leading-snug text-slate-900 line-clamp-2"><Link href={`/articles/${article.slug}`} className="hover:text-[#cf5427]">{localizedTitle(article, language)}</Link></h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{localizedDescription(article, language)}</p>
          <p className="mt-auto pt-3 text-xs text-slate-400">{formatDate(article.createdAt)}</p>
        </div>
      </article>
    );
  };

  return (
    <main className="min-h-screen bg-[var(--cream)] pb-20">
      <section className="relative isolate flex min-h-[480px] items-center justify-center overflow-hidden bg-[#20283a] px-5 pb-20 pt-24 text-center text-white sm:px-8 md:min-h-[550px] md:pb-24 md:pt-28">
        <video key={HERO_VIDEO_SRCS[heroVideoIndex]} src={HERO_VIDEO_SRCS[heroVideoIndex]} onEnded={() => setHeroVideoIndex((i) => (i + 1) % HERO_VIDEO_SRCS.length)} className="absolute inset-0 -z-10 h-full w-full object-cover object-top" autoPlay muted playsInline preload="metadata" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-black/60" />
        <div className="relative mx-auto w-full max-w-4xl">
          <p className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#F47822] backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-[#F47822] animate-pulse" />{t("articles.hero_eyebrow", "Dream More Affiliate Market")}</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#F47822] drop-shadow-lg sm:text-5xl lg:text-6xl">{t("articles.hero_title", "Dream More Articles")}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow sm:text-lg">{t("articles.hero_subtitle", "Discover marketplace news, in-depth product guides, and useful business updates curated directly by Dream More.")}</p>
        </div>
      </section>

      {showNewsletter && (
        <section className="bg-[#1d4ed8] px-4 py-10 text-white sm:px-6">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-200">Weekly Newsletter</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Edit Smarter</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-blue-100">Get the latest media industry news, video releases, and top articles delivered to your inbox every week.</p>
              <Link href="/newsletter" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white underline decoration-blue-300 underline-offset-4 transition hover:decoration-white">View past newsletters →</Link>
            </div>
            <form onSubmit={subscribeNewsletter} className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <input required value={nlForm.firstName} onChange={(e) => setNlForm({ ...nlForm, firstName: e.target.value })} placeholder="First Name" className="h-11 rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20" />
                <input required value={nlForm.lastName} onChange={(e) => setNlForm({ ...nlForm, lastName: e.target.value })} placeholder="Last Name" className="h-11 rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20" />
                <input required type="email" value={nlForm.email} onChange={(e) => setNlForm({ ...nlForm, email: e.target.value })} placeholder="Email Address" className="h-11 rounded-lg border border-slate-300 px-4 text-sm outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20 sm:col-span-2" />
                <input type="text" value={nlForm.website} onChange={(e) => setNlForm({ ...nlForm, website: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              </div>
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Subscribe to</p>
                <div className="flex flex-wrap gap-2">
                  {[{ value: "edit-smarter", label: "Edit Smarter weekly newsletter" }, { value: "news", label: "Media Industry News" }].map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-[#1d4ed8] hover:text-[#1d4ed8]">
                      <input type="checkbox" checked={nlTypes.includes(opt.value)} onChange={() => toggleNlType(opt.value)} className="accent-[#1d4ed8]" />{opt.label}
                    </label>
                  ))}
                </div>
              </div>
              {nlMessage && <p className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold ${nlMessage.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{nlMessage.text}</p>}
              <button type="submit" disabled={nlSubmitting} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1d4ed8] px-6 text-sm font-extrabold uppercase tracking-wide text-white transition hover:bg-[#1e40af] disabled:opacity-60">
                {nlSubmitting && <LoaderCircle size={15} className="animate-spin" />}{nlSubmitting ? "Subscribing…" : "Subscribe"}
              </button>
            </form>
          </div>
        </section>
      )}

      <nav aria-label="Article categories" className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex-1 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-1">
              {catBtn("all", t("articles.all", "All"), totalCount)}
              {categories.map((c) => catBtn(c.slug, language === "am" && c.nameAm ? c.nameAm : c.name, c.count))}
            </ul>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <button type="button" onClick={() => setShowNewsletter((v) => !v)} aria-expanded={showNewsletter} className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-bold transition ${showNewsletter ? "bg-[#1d4ed8] text-white" : "bg-[#1d4ed8]/10 text-[#1d4ed8] hover:bg-[#1d4ed8]/20"}`}>Edit Smarter</button>
            <form onSubmit={handleInlineSearch} className="relative flex-1 sm:w-72 sm:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={query} onChange={(e) => setSearchInput(e.target.value)} placeholder={t("articles.search_placeholder", "Search articles...")} className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none transition focus:border-[#EB6D3D] focus:bg-white focus:ring-2 focus:ring-[#EB6D3D]/20" />
            </form>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex gap-6">
          <div className="hidden lg:block"><ArticleSidebar activeCategory={activeCategory} onCategorySelect={chooseCategory} /></div>
          <div className="flex-1 min-w-0">
            <section className="pt-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-2xl font-bold text-slate-900">{urlSearch ? `${t("articles.search_results_for", "Search results for")} "${urlSearch}"` : activeName}</h2>
                {!loading && <p className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? t("articles.article_singular", "article") : t("articles.article_plural", "articles")}</p>}
              </div>

              {loading ? (
                <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" /></div>
              ) : error ? (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
                  <Image src={LOGO_SRC} alt="Dream More" width={160} height={160} unoptimized className="mx-auto h-20 w-20 object-contain opacity-80" />
                  <h3 className="mt-3 font-semibold text-slate-800">{t("articles.no_articles_title", "No articles found")}</h3>
                  <p className="mt-1 text-sm text-slate-500">{urlSearch ? t("articles.no_articles_search", "Try a different search word.") : t("articles.no_articles_desc", "Please check back soon for marketplace updates and guides.")}</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {showFeatured && (
                    <div className="grid gap-6 lg:grid-cols-5">
                      <div className="flex flex-col divide-y divide-slate-200 border-y border-slate-200 lg:col-span-3">
                        {filtered.slice(1, 3).map(featuredText)}
                        {filtered.length < 3 && featuredText(filtered[0])}
                      </div>
                      {(() => {
                        const hero = filtered[0];
                        const thumb = articleThumb(hero);
                        return (
                          <Link href={`/articles/${hero.slug}`} className="group relative block min-h-[420px] overflow-hidden rounded-lg bg-slate-900 lg:col-span-2">
                            {thumb ? <Image src={thumb} alt="" fill unoptimized priority className="object-cover transition duration-500 group-hover:scale-[1.03]" /> : <LogoPlaceholder className="h-full w-full" size={96} />}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                            {hero.videoUrl && <PlayBadge size={24} big />}
                            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47822]">{categoryName(categories, hero.category, language)}</p>
                              <h3 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{localizedTitle(hero, language)}</h3>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/80">{localizedDescription(hero, language)}</p>
                              <p className="mt-3 text-xs text-white/60">{formatDate(hero.createdAt)}</p>
                            </div>
                          </Link>
                        );
                      })()}
                    </div>
                  )}
                  {(showFeatured ? filtered.slice(3) : filtered).length > 0 && (
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {(showFeatured ? filtered.slice(3) : filtered).map(gridCard)}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center bg-[var(--cream)]"><LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" /></main>}>
      <ArticlesBrowser />
    </Suspense>
  );
}