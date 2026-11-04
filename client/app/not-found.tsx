// app/not-found.tsx
import Link from "next/link";
import { Home, ShoppingBag, Mail, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#faf6ee] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg text-center">
        {/* Big 404 with gold accent */}
        <div className="relative mb-6">
          <span className="block font-serif-heading text-[120px] sm:text-[160px] font-bold leading-none tracking-[-0.05em] text-[#1a1410]/10 select-none">
            404
          </span>
          <span className="absolute inset-0 flex items-center justify-center font-serif-heading text-6xl sm:text-7xl font-bold tracking-[-0.04em] text-[#1a1410]">
            4<span className="text-[#e0a83c]">0</span>4
          </span>
        </div>

        {/* Heading */}
        <h1 className="font-serif-heading text-2xl sm:text-3xl font-bold text-[#1a1410] tracking-[-0.03em]">
          Page Not Found
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-sm leading-6 text-[#7a6a58] max-w-md mx-auto">
          Sorry, we couldnt find the page you were looking for. It may have
          been moved, renamed, or never existed.
        </p>

        {/* Divider */}
        <div className="my-8 flex items-center justify-center gap-3">
          <span className="h-px w-12 bg-[#3a2a1e]/15" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#e0a83c]" />
          <span className="h-px w-12 bg-[#3a2a1e]/15" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#EB6D3D] px-6 text-sm font-bold text-[#20283a] transition hover:bg-[#cf5427] hover:text-white"
          >
            <Home size={16} />
            Back to Home
          </Link>

          <Link
            href="/shop"
            className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#EB6D3D]/50 bg-white px-6 text-sm font-bold text-[#cf5427] transition hover:border-[#EB6D3D] hover:bg-[#EB6D3D] hover:text-[#20283a]"
          >
            <ShoppingBag size={16} />
            Browse Products
          </Link>
        </div>

        {/* Contact hint */}
        <p className="mt-8 text-xs text-[#7a6a58]">
          Need help?{" "}
          <Link
            href="/contact"
            className="inline-flex items-center gap-1 font-semibold text-[#b98a3e] hover:text-[#1a1410]"
          >
            <Mail size={12} />
            Contact our team
          </Link>
        </p>

        {/* Back link */}
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1 text-[11px] text-[#7a6a58] hover:text-[#1a1410]"
        >
          <ArrowLeft size={12} />
          Go back
        </Link>
      </div>
    </main>
  );
}