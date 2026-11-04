// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "./providers";
import ChatbotToggle from "@/components/ChatbotToggle";
import InstallPrompt from "@/components/InstallPrompt";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

// ============================================================
// Site metadata
// ============================================================
export const metadata: Metadata = {
  title: {
    default: "Dream More Affiliate Market",
    template: "%s | Dream More Affiliate Market",
  },
  description:
    "Discover trusted products and great deals with Dream More Affiliate Market.",
  applicationName: "Dream More Affiliate Market",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dream More",
  },
  icons: {
    icon: [
      { url: "/banners/photo.jpg", type: "image/jpeg", sizes: "any" },
    ],
    apple: [
      { url: "/banners/photo.jpg", sizes: "180x180", type: "image/jpeg" },
    ],
    shortcut: ["/banners/photo.jpg"],
  },
  formatDetection: {
    telephone: false,
  },
};

// ============================================================
// Viewport — controls the browser chrome / status bar theme
// ============================================================
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    // Light mode browser UI
    { media: "(prefers-color-scheme: light)", color: "#F47822" },
    // Dark mode browser UI
    { media: "(prefers-color-scheme: dark)", color: "#20283a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sora.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-gray-50 text-gray-900 antialiased"
        style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
      >
        <Providers>
          {/* Navbar is fixed + transparent on /, /about, /shop, /contact
              so do NOT add top padding around {children} */}
          <Navbar />
          {children}
          <Footer />
          <Toaster position="top-right" />
          <ChatbotToggle />

          {/* PWA Install Prompt — appears bottom-right when installable */}
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}