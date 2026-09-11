// lib/legal-content.test.ts
import { getLegalDocument } from "@/lib/legal-content";

describe("legal drafts", () => {
  it("marks every Hungarian document as a review-required draft", () => {
    for (const id of ["terms", "privacy", "cookies", "imprint"] as const) {
      const document = getLegalDocument(id, "hu-HU");
      expect(document.updated).toContain("Tervezet");
      expect(document.sections[0].body).toContain("felülvizsgálata szükséges");
    }
  });

  it("keeps incomplete publisher data visibly marked", () => {
    const imprint = getLegalDocument("imprint", "hu");
    expect(imprint.sections.map((section) => section.body).join(" ")).toContain(
      "[KITÖLTENDŐ]",
    );
  });
});
