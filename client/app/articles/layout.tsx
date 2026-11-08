import type { ReactNode } from "react";
import Link from "next/link";
import ArticlesNavbar from "@/app/articles/ArticlesNavbar";

export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ArticlesNavbar />
      {children}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <p>© {new Date().getFullYear()} Dream More Affiliate Market</p>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-4 font-medium">
            <Link href="/" className="hover:text-[#cf5427]">Home</Link>
            <Link href="/articles" className="hover:text-[#cf5427]">All articles</Link>
            <Link href="/articles/videos" className="hover:text-[#cf5427]">Videos</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}