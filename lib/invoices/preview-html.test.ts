// lib/invoices/preview-html.test.ts
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("generateInvoicePreviewHtml", () => {
  it("includes invoice number and client", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("Acme Kft.");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("escapes HTML in client name", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({ clientName: "<script>alert(1)</script>" })
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes line item description", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toContain("Consulting");
  });

  it("includes issue date with time", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toMatch(/Issue: 2026\. 06\. 01\. \d{2}:\d{2}/);
  });
});
