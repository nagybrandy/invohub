// lib/nav/invoice-xml.test.ts
import { buildNavInvoiceXml } from "@/lib/nav/invoice-xml";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("buildNavInvoiceXml", () => {
  it("builds NAV-style XML with supplier, customer, and totals", () => {
    const invoice = makeInvoice({
      invoiceNumber: "INV-2026-001",
      clientName: "Test Client Kft.",
      clientTaxNumber: "12345678-1-23",
    });
    const xml = buildNavInvoiceXml(invoice, {
      id: "c1",
      userId: "u1",
      name: "Demo Kft.",
      taxNumber: "87654321-2-41",
      createdAt: "",
      updatedAt: "",
    });

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<invoiceNumber>INV-2026-001</invoiceNumber>");
    expect(xml).toContain("<name>Demo Kft.</name>");
    expect(xml).toContain("<name>Test Client Kft.</name>");
    expect(xml).toContain("<grossAmount>");
  });

  it("escapes XML special characters", () => {
    const invoice = makeInvoice({ clientName: "A & B <C>" });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(xml).toContain("A &amp; B &lt;C&gt;");
  });
});
