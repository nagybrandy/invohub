// lib/seo/json-ld.test.ts
import {
  buildBlogPostingJsonLd,
  buildOrganizationJsonLd,
  buildSoftwareApplicationJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

describe("json-ld builders", () => {
  it("builds Organization and SoftwareApplication graphs", () => {
    const org = buildOrganizationJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("InvoHub");
    expect(org.url).toContain("https://");

    const app = buildSoftwareApplicationJsonLd();
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app.applicationCategory).toBe("BusinessApplication");
    expect(app.offers.priceCurrency).toBe("HUF");
  });

  it("builds BlogPosting JSON-LD and serializes it", () => {
    const posting = buildBlogPostingJsonLd({
      title: "Teszt cikk",
      description: "Leírás",
      path: "/blog/teszt",
      datePublished: "2026-09-10",
    });

    expect(posting["@type"]).toBe("BlogPosting");
    expect(posting.headline).toBe("Teszt cikk");
    expect(posting.inLanguage).toBe("hu-HU");
    expect(serializeJsonLd(posting)).toContain("BlogPosting");
  });
});
