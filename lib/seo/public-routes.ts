// lib/seo/public-routes.ts
// Canonical public marketing URLs included in sitemap and domain routing.
import { listBlogPosts } from "@/lib/blog";
import { isMarketingPublicPath as isDomainMarketingPath } from "@/lib/domain-routing";
import type { SitemapEntry } from "@/lib/seo/sitemap";

export const LEGAL_PUBLIC_PATHS = [
  "/aszf",
  "/adatkezeles",
  "/cookie-tajekoztato",
  "/impresszum",
] as const;

export function isMarketingPublicPath(pathname: string): boolean {
  return isDomainMarketingPath(pathname);
}

export function buildMarketingSitemapEntries(): SitemapEntry[] {
  const staticEntries: SitemapEntry[] = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/blog", changeFrequency: "weekly", priority: 0.9 },
    ...LEGAL_PUBLIC_PATHS.map((path) => ({
      path,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const blogEntries: SitemapEntry[] = listBlogPosts().map((post) => ({
    path: `/blog/${post.slug}`,
    lastModified: post.updatedAt ?? post.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...blogEntries];
}
