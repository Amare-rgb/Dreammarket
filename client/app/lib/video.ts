export type VideoSource =
  | { kind: "iframe"; src: string }
  | { kind: "file"; src: string }
  | { kind: "link"; src: string };

const VIDEO_FILE = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getVideoSource(rawUrl: string): VideoSource | null {
  const value = rawUrl.trim();
  if (!value || !isValidHttpUrl(value)) return null;

  const url = new URL(value);
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  let youtubeId: string | null = null;
  if (host === "youtu.be") {
    youtubeId = parts[0] || null;
  } else if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") youtubeId = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) {
      youtubeId = parts[1] || null;
    }
  } else if (host === "youtube-nocookie.com" && parts[0] === "embed") {
    youtubeId = parts[1] || null;
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{5,})/)?.[1];
    if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
  }

  if (VIDEO_FILE.test(url.pathname)) return { kind: "file", src: url.toString() };

  return { kind: "link", src: url.toString() };
}