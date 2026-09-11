// lib/seo/robots.ts
// robots.txt body for the marketing host, pointing crawlers at the sitemap.
import { absoluteUrl } from "@/lib/seo/site";

export function buildRobotsTxt(sitemapPath = "/sitemap.xml"): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /invoices",
    "Disallow: /clients",
    "Disallow: /products",
    "Disallow: /settings",
    "Disallow: /admin",
    "Disallow: /api/",
    "",
    `Sitemap: ${absoluteUrl(sitemapPath)}`,
    "",
  ].join("\n");
}
