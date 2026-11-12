import type { ReactNode } from "react";
import { Suspense } from "react";
import ArticlesNavbar from "@/app/articles/ArticlesNavbar";

export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <ArticlesNavbar />
      </Suspense>
      {children}
    </>
  );
}