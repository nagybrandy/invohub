// app/sitemap.xml+api.ts
// Dynamic XML sitemap for marketing, legal, and blog URLs.
import { buildMarketingSitemapEntries, buildSitemapXml } from "@/lib/seo";

export async function GET() {
  const xml = buildSitemapXml(buildMarketingSitemapEntries());
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
