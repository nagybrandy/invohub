// lib/marketing/static-site.test.ts
// Coverage for marketing route resolution and asset detection.
import {
  isMarketingAssetPath,
  MARKETING_STATIC_DIR,
  resolveMarketingHtmlPath,
} from "@/lib/marketing/static-site";

describe("resolveMarketingHtmlPath", () => {
  it("serves the static homepage for the site root", () => {
    expect(resolveMarketingHtmlPath("/")).toBe(`${MARKETING_STATIC_DIR}/index.html`);
  });

  it("ignores query strings and hashes", () => {
    expect(resolveMarketingHtmlPath("/?utm_source=hirlevel")).toBe(
      `${MARKETING_STATIC_DIR}/index.html`,
    );
    expect(resolveMarketingHtmlPath("/#termek")).toBe(
      `${MARKETING_STATIC_DIR}/index.html`,
    );
  });

  it("falls through for application routes", () => {
    expect(resolveMarketingHtmlPath("/login")).toBeNull();
    expect(resolveMarketingHtmlPath("/dashboard")).toBeNull();
    expect(resolveMarketingHtmlPath("/blog/magyar-szamlazas-alapok")).toBeNull();
  });

  it("does not resolve traversal attempts to the homepage", () => {
    expect(resolveMarketingHtmlPath("/../etc/passwd")).toBeNull();
    expect(resolveMarketingHtmlPath("/%2e%2e/secret")).toBeNull();
  });

  it("tolerates malformed percent encoding", () => {
    expect(resolveMarketingHtmlPath("/%E0%A4%A")).toBeNull();
  });
});

describe("isMarketingAssetPath", () => {
  it("detects static marketing assets", () => {
    expect(isMarketingAssetPath("/marketing/assets/site.css")).toBe(true);
    expect(isMarketingAssetPath("/marketing/assets/mark.svg")).toBe(true);
  });

  it("rejects application and API paths", () => {
    expect(isMarketingAssetPath("/")).toBe(false);
    expect(isMarketingAssetPath("/api/invoices")).toBe(false);
  });
});
