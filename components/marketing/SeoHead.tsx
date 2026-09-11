// components/marketing/SeoHead.tsx
// Injects title, description, canonical, Open Graph, Twitter, and JSON-LD into the document head.
import Head from "expo-router/head";
import type { PageSeo } from "@/lib/seo/meta";
import { serializeJsonLd } from "@/lib/seo/json-ld";

type SeoHeadProps = {
  seo: PageSeo;
  jsonLd?: object | object[];
};

export function SeoHead({ seo, jsonLd }: SeoHeadProps) {
  const graphs = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Head>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={seo.robots} />
      <link rel="canonical" href={seo.canonical} />

      <meta property="og:title" content={seo.ogTitle} />
      <meta property="og:description" content={seo.ogDescription} />
      <meta property="og:url" content={seo.ogUrl} />
      <meta property="og:type" content={seo.ogType} />
      <meta property="og:image" content={seo.ogImage} />
      <meta property="og:locale" content={seo.ogLocale} />
      <meta property="og:site_name" content={seo.ogSiteName} />

      <meta name="twitter:card" content={seo.twitterCard} />
      <meta name="twitter:title" content={seo.ogTitle} />
      <meta name="twitter:description" content={seo.ogDescription} />
      <meta name="twitter:image" content={seo.ogImage} />

      {seo.publishedTime ? (
        <meta property="article:published_time" content={seo.publishedTime} />
      ) : null}
      {seo.modifiedTime ? (
        <meta property="article:modified_time" content={seo.modifiedTime} />
      ) : null}

      {graphs.map((graph, index) => (
        <script
          // eslint-disable-next-line react/no-danger
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
        />
      ))}
    </Head>
  );
}
