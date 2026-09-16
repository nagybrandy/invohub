// lib/invoices/pdf-layout.test.ts
import {
  companyInitials,
  contentBottom,
  FOOTER_BAND_HEIGHT,
  footerBandTop,
} from "@/lib/invoices/pdf-layout";

describe("companyInitials", () => {
  it("uses first letters of first two words", () => {
    expect(companyInitials("InvoHub Demo Kft.")).toBe("ID");
  });

  it("uses first two letters for single word", () => {
    expect(companyInitials("Acme")).toBe("AC");
  });

  it("returns fallback for empty name", () => {
    expect(companyInitials("   ")).toBe("?");
  });
});

describe("footerBandTop (AC9)", () => {
  const stubPage = () => ({
    page: {
      width: 595.28,
      height: 841.89,
      margins: { left: 48, right: 48, top: 48, bottom: 48 },
    },
  });

  it("equals contentBottom(doc) with the default reserve", () => {
    const doc = stubPage() as unknown as Parameters<typeof footerBandTop>[0];
    expect(footerBandTop(doc)).toBe(contentBottom(doc));
  });

  it("reserves exactly FOOTER_BAND_HEIGHT above the bottom margin", () => {
    const doc = stubPage() as unknown as Parameters<typeof footerBandTop>[0];
    expect(FOOTER_BAND_HEIGHT).toBe(36);
    expect(doc.page.height - doc.page.margins.bottom - footerBandTop(doc)).toBe(
      FOOTER_BAND_HEIGHT
    );
  });
});
