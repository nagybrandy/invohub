// lib/invoices/pdf-document.test.ts
import fs from "node:fs";
import path from "node:path";
import { resolvePdfkitDataDir } from "@/lib/invoices/pdf-document";

describe("resolvePdfkitDataDir", () => {
  it("points at pdfkit font data from project node_modules", () => {
    const dir = resolvePdfkitDataDir();
    expect(dir).toContain(`${path.sep}pdfkit${path.sep}js${path.sep}data`);
    expect(fs.existsSync(path.join(dir, "Helvetica.afm"))).toBe(true);
  });
});
