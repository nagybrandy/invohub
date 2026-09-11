// lib/blog/index.ts
// Blog index and slug resolution over the typed static post catalog.
import { blogPosts } from "@/lib/blog/posts";
import type { BlogPost, BlogPostSummary } from "@/lib/blog/types";

export function listBlogPosts(): BlogPostSummary[] {
  return [...blogPosts]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      titleEn: post.titleEn,
      description: post.description,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      readingMinutes: post.readingMinutes,
      tags: post.tags,
    }));
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getRelatedBlogPosts(slug: string, limit = 3): BlogPostSummary[] {
  const post = getBlogPostBySlug(slug);
  if (!post) {
    return [];
  }

  const related = (post.relatedSlugs ?? [])
    .map((relatedSlug) => getBlogPostBySlug(relatedSlug))
    .filter((candidate): candidate is BlogPost => Boolean(candidate))
    .map((candidate) => ({
      slug: candidate.slug,
      title: candidate.title,
      titleEn: candidate.titleEn,
      description: candidate.description,
      publishedAt: candidate.publishedAt,
      updatedAt: candidate.updatedAt,
      readingMinutes: candidate.readingMinutes,
      tags: candidate.tags,
    }));

  if (related.length >= limit) {
    return related.slice(0, limit);
  }

  const extras = listBlogPosts().filter(
    (candidate) =>
      candidate.slug !== slug &&
      !related.some((item) => item.slug === candidate.slug),
  );

  return [...related, ...extras].slice(0, limit);
}

export function getAllBlogSlugs(): string[] {
  return blogPosts.map((post) => post.slug);
}

export { blogPosts };
