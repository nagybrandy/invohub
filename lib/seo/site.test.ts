// lib/seo/site.test.ts
import { absoluteUrl, getMarketingOrigin } from "@/lib/seo/site";

describe("site url helpers", () => {
  it("prefers SITE_URL and strips trailing slash", () => {
    expect(
      getMarketingOrigin({ SITE_URL: "https://example.com/" } as NodeJS.ProcessEnv),
    ).toBe("https://example.com");
  });

  it("builds absolute URLs from pathnames", () => {
    expect(absoluteUrl("/blog", "https://invohub.hu")).toBe(
      "https://invohub.hu/blog",
    );
    expect(absoluteUrl("/", "https://invohub.hu")).toBe("https://invohub.hu/");
  });
});
