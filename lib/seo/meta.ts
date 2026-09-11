// lib/seo/meta.ts
// Builds per-page title, description, Open Graph, Twitter, and canonical metadata.
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE_PATH,
  SITE_LOCALE,
  SITE_NAME,
} from "@/lib/seo/site";

export type PageSeoInput = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  imagePath?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noIndex?: boolean;
};

export type PageSeo = {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogType: "website" | "article";
  ogImage: string;
  ogLocale: string;
  ogSiteName: string;
  twitterCard: "summary_large_image";
  robots: string;
  publishedTime?: string;
  modifiedTime?: string;
};

export function buildPageSeo(input: PageSeoInput): PageSeo {
  const title = input.title.includes(SITE_NAME)
    ? input.title
    : `${input.title} · ${SITE_NAME}`;
  const canonical = absoluteUrl(input.path);
  const ogImage = absoluteUrl(input.imagePath ?? DEFAULT_OG_IMAGE_PATH);

  return {
    title,
    description: input.description,
    canonical,
    ogTitle: title,
    ogDescription: input.description,
    ogUrl: canonical,
    ogType: input.type ?? "website",
    ogImage,
    ogLocale: SITE_LOCALE,
    ogSiteName: SITE_NAME,
    twitterCard: "summary_large_image",
    robots: input.noIndex ? "noindex, nofollow" : "index, follow",
    publishedTime: input.publishedTime,
    modifiedTime: input.modifiedTime,
  };
}
