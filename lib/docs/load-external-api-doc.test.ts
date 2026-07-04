// lib/docs/load-external-api-doc.test.ts
import fs from "node:fs";
import {
  getExternalApiDocPath,
  loadExternalApiDoc,
} from "@/lib/docs/load-external-api-doc";

describe("loadExternalApiDoc", () => {
  it("loads markdown from docs folder", () => {
    const path = getExternalApiDocPath();
    expect(fs.existsSync(path)).toBe(true);
    const content = loadExternalApiDoc();
    expect(content).toContain("# InvoHub External API");
    expect(content).toContain("POST /api/v1/invoices");
    expect(content).toContain("GET /api/v1/invoices");
  });
});
