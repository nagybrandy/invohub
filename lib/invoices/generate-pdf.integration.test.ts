// lib/invoices/generate-pdf.integration.test.ts
// Real pdfkit + real fonts, no mocks — exercises the actual embedding path
// end to end (AC8). Deliberately the slowest test in this area; keep it to
// one case.
/** @jest-environment node */
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { buildSamplePreviewInvoice } from "@/lib/invoices/pdf-template/sample-invoice";

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
});
