// next.config.ts
import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const isProd = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────
// Normalize the backend URL:
//   • trim whitespace
//   • remove trailing slashes
//   • remove trailing "/api"
// ─────────────────────────────────────────────────────────────
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

type ImagePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
};

// Allow images from whatever backend NEXT_PUBLIC_API_URL points to
const apiPattern: ImagePattern | null = (() => {
  try {
    const u = new URL(API_URL);
    return {
      protocol: u.protocol === "https:" ? "https" : "http",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: "/**",
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Allow dev requests from your ngrok tunnel origin
  allowedDevOrigins: ["concise-skunk-preferably.ngrok-free.app"],

  // Watchpack can choke on Windows system files (DumpStack.log.tmp,
  // pagefile.sys) when the dev server resolves watchers near the drive
  // root. Polling mode avoids the buggy recursive lstat scan.
  watchOptions: {
    pollIntervalMs: 1000,
  },

  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/DumpStack.log.tmp",
        "**/pagefile.sys",
        "**/hiberfil.sys",
        "**/swapfile.sys",
        "D:\\DumpStack.log.tmp",
        "D:\\pagefile.sys",
        "D:\\hiberfil.sys",
        "D:\\swapfile.sys",
      ],
    };
    return config;
  },

  images: {
    dangerouslyAllowLocalIP: !isProd,

    remotePatterns: [
      // ── Backend from NEXT_PUBLIC_API_URL (exact host) ───────────────
      ...(apiPattern ? [apiPattern] : []),

      // ── Railway backend (wildcard — covers all *.up.railway.app) ────
      {
        protocol: "https",
        hostname: "*.up.railway.app",
        pathname: "/**",
      },

      // ── Local backend (development) ─────────────────────────────────
      { protocol: "http", hostname: "localhost", port: "5000", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/**" },

      // ── Cloudinary (all product / avatar / category images) ─────────
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },

      // ── Other external image hosts ──────────────────────────────────
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "ui-avatars.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
    ],
  },
};

export default withPWA(nextConfig);