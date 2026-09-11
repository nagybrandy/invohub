// lib/seo/json-ld.ts
// Structured data builders for Organization, SoftwareApplication, and BlogPosting.
import { absoluteUrl, SITE_NAME } from "@/lib/seo/site";

export type OrganizationJsonLd = {
  "@context": "https://schema.org";
  "@type": "Organization";
  name: string;
  url: string;
  logo: string;
  sameAs: string[];
};

export type SoftwareApplicationJsonLd = {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  name: string;
  applicationCategory: string;
  operatingSystem: string;
  url: string;
  description: string;
  offers: {
    "@type": "Offer";
    price: string;
    priceCurrency: string;
  };
};

export type BlogPostingJsonLd = {
  "@context": "https://schema.org";
  "@type": "BlogPosting";
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  inLanguage: string;
  mainEntityOfPage: string;
  author: {
    "@type": "Organization";
    name: string;
  };
  publisher: {
    "@type": "Organization";
    name: string;
    logo: {
      "@type": "ImageObject";
      url: string;
    };
  };
};

export function buildOrganizationJsonLd(): OrganizationJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/marketing/assets/logo-512.png"),
    sameAs: [],
  };
}

export function buildSoftwareApplicationJsonLd(
  description =
    "Magyar vállalkozásoknak készült számlázási munkatér PDF-küldéssel, partner- és terméktörzzsel, valamint fizetési emlékeztetőkkel.",
): SoftwareApplicationJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    url: absoluteUrl("/"),
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "HUF",
    },
  };
}

export function buildBlogPostingJsonLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  inLanguage?: string;
}): BlogPostingJsonLd {
  const url = absoluteUrl(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    inLanguage: input.inLanguage ?? "hu-HU",
    mainEntityOfPage: url,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/marketing/assets/logo-512.png"),
      },
    },
  };
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data);
}
