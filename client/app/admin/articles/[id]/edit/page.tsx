"use client";

import { useParams } from "next/navigation";
import ArticleForm from "../../ArticleForm";

export default function EditArticlePage() {
  const params = useParams<{ id: string }>();
  return <ArticleForm articleId={params.id} />;
}