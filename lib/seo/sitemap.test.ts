// lib/seo/sitemap.test.ts
import { buildMarketingSitemapEntries } from "@/lib/seo/public-routes";
import { buildRobotsTxt } from "@/lib/seo/robots";
import { buildSitemapXml } from "@/lib/seo/sitemap";

describe("sitemap and robots", () => {
  it("includes landing, blog index, legal pages, and article URLs", () => {
    const entries = buildMarketingSitemapEntries();
    const paths = entries.map((entry) => entry.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/blog",
        "/aszf",
        "/adatkezeles",
        "/cookie-tajekoztato",
        "/impresszum",
        "/blog/magyar-szamlazas-alapok",
      ]),
    );

    const xml = buildSitemapXml(entries);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<urlset");
    expect(xml).toContain("https://invohub.hu/blog/magyar-szamlazas-alapok");
  });

  it("builds robots.txt with sitemap pointer and private path disallow", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Disallow: /dashboard");
    expect(robots).toContain("Sitemap: https://invohub.hu/sitemap.xml");
  });
});
