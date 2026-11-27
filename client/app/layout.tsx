import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Providers } from "./providers";
import ChatbotToggle from "@/components/ChatbotToggle";
import InstallPrompt from "@/components/InstallPrompt";
import "./globals.css";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
  
    { media: "(prefers-color-scheme: light)", color: "#F47822" },
   
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
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-gray-50 text-gray-900 antialiased"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        <Providers>
          <Navbar />
          {children}
          <Footer />
          <Toaster position="top-right" />
          <ChatbotToggle />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}