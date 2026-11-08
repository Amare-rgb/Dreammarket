export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  category?: string | null;
  image: string | null;
  videoUrl?: string | null;
  createdAt: string;
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  note: string | null;
  views?: number;
}

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const readingMinutes = (text: string) =>
  Math.max(1, Math.round(text.trim().split(/\s+/).length / 200));

export const categoryName = (
  categories: PublicCategory[],
  slug?: string | null
) => categories.find((c) => c.slug === slug)?.name ?? "General";