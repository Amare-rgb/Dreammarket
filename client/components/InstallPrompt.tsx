"use client";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const STORAGE_KEY = "pwa-install-dismissed";
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === "true") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("✅ PWA installed");
    } else {
      console.log("❌ PWA install dismissed");
    }
    setDeferredPrompt(null);
    setVisible(false);
  };
  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] w-[calc(100%-3rem)] max-w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-2xl bg-[#0f1e38] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] border border-white/5">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white leading-tight">
            Install App
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/60">
            Add to home screen for native experience
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center gap-1.5 rounded-full bg-[#c8871e] px-4 py-2 text-[12px] font-bold text-white shadow-md transition-all hover:bg-[#d99a2a] hover:scale-[1.03] active:scale-95 shrink-0"
        >
          <Download size={14} strokeWidth={2.4} />
          <span>Install</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}