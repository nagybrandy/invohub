// lib/invoices/generate-pdf.integration.test.ts
// Real pdfkit + real fonts, no mocks — exercises the actual embedding path
// end to end (AC8) and, since the pdf-invohub-brand-mark slice, the brand
// mark's arc ("A") path commands (AC10). Deliberately the slowest tests in
// this area; keep the case count small.
/** @jest-environment node */
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";

// Measured against the pre-slice generate-pdf.ts: buildSamplePreviewInvoice()
// rendered 2 pages both with and without a company (the near-blank second
// page is backlog item 3 — out of scope here, see plan §9). AC10 requires
// this slice never *increase* that count.
const BASELINE_PAGE_COUNT = 2;

function countPages(pdf: Buffer): number | null {
  const text = pdf.toString("latin1");
  const match = text.match(/\/Type\s*\/Pages[^]*?\/Count\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

describe("generateInvoicePdf (real pdfkit integration)", () => {
  it("generates a %PDF buffer with an embedded FontFile2 for the sample invoice", async () => {
    const invoice = buildSamplePreviewInvoice();

    const pdf = await generateInvoicePdf({
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    // FontFile2 is the PDF stream keyword for an embedded TrueType font
    // program — its presence means a real font is embedded, not merely
    // referenced by name.
    expect(pdf.includes("FontFile2")).toBe(true);
  });

  it("renders the brand mark's arc path commands without throwing and without increasing the page count, with a company (AC10)", async () => {
    const invoice = buildSamplePreviewInvoice();

    const pdf = await generateInvoicePdf({
      invoice,
      company: { name: "InvoHub Demo Kft.", taxNumber: "12345678-2-41" },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.includes("FontFile2")).toBe(true);

    const pageCount = countPages(pdf);
    expect(pageCount).not.toBeNull();
    expect(pageCount as number).toBeLessThanOrEqual(BASELINE_PAGE_COUNT);
  });

  it("renders the same, without a company (AC10)", async () => {
    const invoice = buildSamplePreviewInvoice();

    const pdf = await generateInvoicePdf({ invoice });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(pdf.includes("FontFile2")).toBe(true);

    const pageCount = countPages(pdf);
    expect(pageCount).not.toBeNull();
    expect(pageCount as number).toBeLessThanOrEqual(BASELINE_PAGE_COUNT);
  });
});
