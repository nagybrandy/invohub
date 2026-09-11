// lib/seo/index.ts
// Public SEO helper barrel for site URLs, meta, JSON-LD, sitemap, and robots.
export {
  absoluteUrl,
  getMarketingOrigin,
  SITE_LOCALE,
  SITE_NAME,
  DEFAULT_OG_IMAGE_PATH,
} from "@/lib/seo/site";
export { buildPageSeo, type PageSeo, type PageSeoInput } from "@/lib/seo/meta";
export {
  buildOrganizationJsonLd,
  buildSoftwareApplicationJsonLd,
  buildBlogPostingJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
export { buildSitemapXml, type SitemapEntry } from "@/lib/seo/sitemap";
export { buildRobotsTxt } from "@/lib/seo/robots";
export {
  buildMarketingSitemapEntries,
  isMarketingPublicPath,
  LEGAL_PUBLIC_PATHS,
} from "@/lib/seo/public-routes";
