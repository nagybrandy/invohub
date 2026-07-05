// lib/invoices/pdf-document.test.ts
/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import { resolvePdfkitDataDir } from "@/lib/invoices/pdf-document";

describe("resolvePdfkitDataDir", () => {
  it("points at bundled or vendored pdfkit font data", () => {
    const dir = resolvePdfkitDataDir();
    expect(dir).toMatch(/pdfkit-data|pdfkit[/\\]js[/\\]data/);
    expect(fs.existsSync(path.join(dir, "Helvetica.afm"))).toBe(true);
  });
});
