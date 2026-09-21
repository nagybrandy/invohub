// lib/invoices/document-ink.test.ts
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "@/lib/theme/contrast";
import { documentInk, documentSurfaces } from "@/lib/invoices/document-ink";

describe("documentSurfaces", () => {
  it("matches the document's real paper/mist/pale-blue hexes", () => {
    expect(documentSurfaces.paper).toBe("#ffffff");
    expect(documentSurfaces.mist).toBe("#edf2fa");
    expect(documentSurfaces.paleBlue).toBe("#d9e7ff");
  });

  it("every surface value is a lowercase 6-digit hex", () => {
    for (const hex of Object.values(documentSurfaces)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("documentInk", () => {
  it("has body, heading, secondary and muted keys, each a lowercase 6-digit hex", () => {
    expect(documentInk).toHaveProperty("body");
    expect(documentInk).toHaveProperty("heading");
    expect(documentInk).toHaveProperty("secondary");
    expect(documentInk).toHaveProperty("muted");
    for (const hex of Object.values(documentInk)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // AC4: table-driven — every ink reaches AA on paper, so a later-added
  // ink is covered automatically without a new test.
  it.each(Object.entries(documentInk))(
    "%s reaches WCAG AA (>= 4.5:1) against documentSurfaces.paper",
    (_name, hex) => {
      expect(contrastRatio(hex, documentSurfaces.paper)).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT
      );
    }
  );

  // AC3: muted specifically must clear AA on every document surface, not
  // just paper — asserted as a loop, not three hardcoded numbers.
  it.each(Object.entries(documentSurfaces))(
    "muted ink reaches WCAG AA against surface %s",
    (_name, hex) => {
      expect(contrastRatio(documentInk.muted, hex)).toBeGreaterThanOrEqual(
        WCAG_AA_NORMAL_TEXT
      );
    }
  );

  // AC5: the fix must not flatten the hierarchy — muted stays visually
  // subordinate to secondary.
  it("keeps muted strictly lighter (lower-contrast) than secondary on paper", () => {
    expect(contrastRatio(documentInk.muted, documentSurfaces.paper)).toBeLessThan(
      contrastRatio(documentInk.secondary, documentSurfaces.paper)
    );
  });

  it("no longer uses the old sub-AA #8a90a6 ink", () => {
    for (const hex of Object.values(documentInk)) {
      expect(hex.toLowerCase()).not.toBe("#8a90a6");
    }
  });
});
