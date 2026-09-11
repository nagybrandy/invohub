// lib/seo/meta.test.ts
import { buildPageSeo } from "@/lib/seo/meta";

describe("buildPageSeo", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
  });

  it("builds canonical, OG, and title metadata for a page", () => {
    process.env.MARKETING_HOST = "invohub.hu";
    const seo = buildPageSeo({
      title: "Blog",
      description: "InvoHub tudásanyag",
      path: "/blog",
    });

    expect(seo.title).toBe("Blog · InvoHub");
    expect(seo.canonical).toBe("https://invohub.hu/blog");
    expect(seo.ogUrl).toBe("https://invohub.hu/blog");
    expect(seo.ogType).toBe("website");
    expect(seo.ogLocale).toBe("hu_HU");
    expect(seo.robots).toBe("index, follow");
    expect(seo.twitterCard).toBe("summary_large_image");
  });

  it("keeps an existing brand title and supports article noindex", () => {
    process.env.SITE_URL = "https://www.invohub.hu";
    const seo = buildPageSeo({
      title: "InvoHub",
      description: "Landing",
      path: "/",
      type: "article",
      noIndex: true,
      publishedTime: "2026-09-10",
    });

    expect(seo.title).toBe("InvoHub");
    expect(seo.ogType).toBe("article");
    expect(seo.robots).toBe("noindex, nofollow");
    expect(seo.publishedTime).toBe("2026-09-10");
    expect(seo.canonical).toBe("https://www.invohub.hu/");
  });
});
