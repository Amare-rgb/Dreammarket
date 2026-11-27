"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  LoaderCircle,
  PlayCircle,
  Search,
  Video,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { getVideoSource } from "@/lib/video";
import VideoPlayer from "@/components/VideoPlayer";
import { ArticleSummary, formatDate, localizedDescription, localizedTitle } from "@/lib/publicArticles";
import { useLanguage } from "@/context/LanguageContext";

const HERO_VIDEO_SRCS = [
  "/banners/articl1.mp4",
  "/banners/articl2.mp4",
  "/banners/articl3.mp4",
];

// YouTube videos get an automatic thumbnail when the article has no image.
function youtubeThumbnail(videoUrl: string) {
  const source = getVideoSource(videoUrl);
  if (source?.kind !== "iframe") return null;
  const id = source.src.match(/youtube-nocookie\.com\/embed\/([\w-]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export default function VideosPage() {
  const { language, t } = useLanguage();
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<ArticleSummary | null>(null);
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .get("/api/articles")
      .then((res) => {
        if (!active) return;
        const list: ArticleSummary[] = res.data?.articles || [];
        setArticles(list.filter((a) => a.videoUrl && getVideoSource(a.videoUrl)));
      })
      .catch(() => {
        if (active) setError("Videos could not be loaded. Please try again later.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(null);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.titleAm || "").toLowerCase().includes(q) ||
        (a.descriptionAm || "").toLowerCase().includes(q)
    );
  }, [articles, query]);

  return (
    <main className="min-h-screen bg-[var(--cream)] pb-20">
      <section className="relative isolate flex min-h-[480px] items-center justify-center overflow-hidden bg-[#20283a] px-5 pb-20 pt-24 text-center text-white sm:px-8 md:min-h-[550px] md:pb-24 md:pt-28">
        <video
          key={HERO_VIDEO_SRCS[heroVideoIndex]}
          src={HERO_VIDEO_SRCS[heroVideoIndex]}
          onEnded={() =>
            setHeroVideoIndex((i) => (i + 1) % HERO_VIDEO_SRCS.length)
          }
          className="absolute inset-0 -z-10 h-full w-full object-cover object-top"
          autoPlay
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 via-black/25 to-black/45" />
        <div className="relative mx-auto w-full max-w-3xl">
          <p className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[#F47822] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F47822] animate-pulse" />
            {t("articles.hero_eyebrow", "Dream More Affiliate Market")}
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#F47822] drop-shadow-lg sm:text-5xl lg:text-6xl">
            {t("articles.videos_title", "Videos")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/90 drop-shadow sm:text-lg">
            {t("articles.videos_subtitle", "Watch product guides and marketplace updates.")}
          </p>

          <div className="relative mx-auto mt-8 max-w-xl">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("articles.search_videos", "Search videos")}
              aria-label={t("articles.search_videos", "Search videos")}
              className="h-12 w-full rounded-xl border-0 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none ring-2 ring-transparent focus:ring-[#EB6D3D]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {!loading && !error && (
          <p className="mb-6 text-sm text-slate-500">
            {filtered.length}{" "}
            {filtered.length === 1
              ? t("articles.video_singular", "video")
              : t("articles.video_plural", "videos")}
          </p>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#F47822]" />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
            <Video className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">
              {t("articles.no_videos_title", "No videos found")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {query
                ? t("articles.no_articles_search", "Try a different search word.")
                : t("articles.no_videos_desc", "Articles with a video will appear here.")}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((article) => {
              const thumbnail = article.image || youtubeThumbnail(article.videoUrl as string);
              return (
                <article
                  key={article.id}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#EB6D3D]/50 hover:shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => setPlaying(article)}
                    aria-label={`${t("articles.play", "Play")} ${localizedTitle(article, language)}`}
                    className="relative block text-left"
                  >
                    {thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt=""
                        width={700}
                        height={420}
                        unoptimized
                        className="h-52 w-full object-cover"
                      />
                    ) : (
                      <div className="h-52 w-full bg-gradient-to-br from-[#20283a] to-slate-700" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/40">
                      <PlayCircle size={56} className="text-white drop-shadow" strokeWidth={1.5} />
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <p className="text-xs text-slate-400">{formatDate(article.createdAt)}</p>
                    <h2 className="mt-1.5 text-lg font-bold leading-snug text-slate-900">
                      {localizedTitle(article, language)}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {localizedDescription(article, language)}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setPlaying(article)}
                        className="text-sm font-semibold text-slate-600 transition hover:text-[#cf5427]"
                      >
                        {t("articles.watch_now", "Watch now")}
                      </button>
                      <Link
                        href={`/articles/${article.slug}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#cf5427] transition hover:text-[#9c3d1a]"
                      >
                        Read article <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {playing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPlaying(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-title"
            className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
          >
            <button
              type="button"
              onClick={() => setPlaying(null)}
              aria-label={t("articles.close_video", "Close video")}
              className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 text-slate-700 shadow transition hover:text-slate-950"
            >
              <X size={20} />
            </button>
            <h2 id="video-title" className="pr-10 text-xl font-bold text-slate-900">
              {localizedTitle(playing, language)}
            </h2>
            <div className="mt-4">
              <VideoPlayer url={playing.videoUrl as string} title={localizedTitle(playing, language)} />
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                href={`/articles/${playing.slug}`}
                className="inline-flex items-center gap-2 rounded-lg bg-[#EB6D3D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#cf5427]"
              >
                Open full article <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}