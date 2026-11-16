export interface PublicSubcategory {
  id: string;
  name: string;
  nameAm?: string | null;
  slug: string;
  count: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  nameAm?: string | null;
  slug: string;
  count: number;
  subcategories?: PublicSubcategory[];
}

export interface ArticleSummary {
  id: string;
  title: string;
  titleAm?: string | null;
  slug: string;
  description: string;
  descriptionAm?: string | null;
  category?: string | null;
  image: string | null;
  videoUrl?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
}

export interface ArticleDetail extends ArticleSummary {
  content: string;
  contentAm?: string | null;
  note: string | null;
  noteAm?: string | null;
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
  slug?: string | null,
  lang: "en" | "am" = "en"
) => {
  for (const c of categories) {
    if (c.slug === slug)
      return lang === "am" && c.nameAm ? c.nameAm : c.name;
    const sub = c.subcategories?.find((s) => s.slug === slug);
    if (sub) return lang === "am" && sub.nameAm ? sub.nameAm : sub.name;
  }
  return "General";
};

/** Pick the Amharic field when the UI language is 'am' and a translation exists. */
export const localizedTitle = (
  article: Pick<ArticleSummary, "title" | "titleAm">,
  lang: "en" | "am"
) => (lang === "am" && article.titleAm ? article.titleAm : article.title);

export const localizedDescription = (
  article: Pick<ArticleSummary, "description" | "descriptionAm">,
  lang: "en" | "am"
) =>
  lang === "am" && article.descriptionAm
    ? article.descriptionAm
    : article.description;

export const localizedContent = (
  article: Pick<ArticleDetail, "content" | "contentAm">,
  lang: "en" | "am"
) => (lang === "am" && article.contentAm ? article.contentAm : article.content);

export const localizedNote = (
  article: Pick<ArticleDetail, "note" | "noteAm">,
  lang: "en" | "am"
) => (lang === "am" && article.noteAm ? article.noteAm : article.note);