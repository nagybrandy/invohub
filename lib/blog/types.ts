// lib/blog/types.ts
// Typed blog post model for the static content module (no CMS).

export type BlogSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogPost = {
  slug: string;
  /** Optional English title for SEO/hreflang-style labeling; HU title is primary. */
  titleEn?: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  readingMinutes: number;
  tags: string[];
  sections: BlogSection[];
  relatedSlugs?: string[];
};

export type BlogPostSummary = Pick<
  BlogPost,
  | "slug"
  | "title"
  | "titleEn"
  | "description"
  | "publishedAt"
  | "updatedAt"
  | "readingMinutes"
  | "tags"
>;
