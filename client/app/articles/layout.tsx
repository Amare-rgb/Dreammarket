import type { ReactNode } from "react";
import ArticlesNavbar from "@/app/articles/ArticlesNavbar";

export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ArticlesNavbar />
      {children}
    </>
  );
}