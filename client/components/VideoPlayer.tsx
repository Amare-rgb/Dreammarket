import { ExternalLink } from "lucide-react";
import { getVideoSource } from "@/lib/video";

export default function VideoPlayer({ url, title }: { url: string; title: string }) {
  const source = getVideoSource(url);
  if (!source) return null;

  if (source.kind === "iframe") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-black">
        <iframe
          src={source.src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  if (source.kind === "file") {
    return (
      <video
        controls
        preload="metadata"
        playsInline
        className="aspect-video w-full rounded-xl border border-slate-200 bg-black"
      >
        <source src={source.src} />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <a
      href={source.src}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-[#9c3d1a] transition hover:border-[#EB6D3D] hover:bg-[#EB6D3D]/10"
    >
      <ExternalLink size={16} /> Open video link
    </a>
  );
}