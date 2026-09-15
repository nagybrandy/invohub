// lib/invoices/preview-html.test.ts
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { formatDocumentAmount } from "@/lib/invoices/document-labels";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

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

  it("escapes HTML in the company name and a line item description", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({
        lineItems: [makeLineItem({ description: "<img src=x onerror=alert(1)>" })],
      }),
      { company: { name: "<b>Evil</b> Kft." } }
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
  });

  it("includes line item description", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toContain("Consulting");
  });

  it("includes the Hungarian issue date and due date labels with formatted dates", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toMatch(/Kiállítás kelte: 2026\. 06\. 01\. \d{2}:\d{2}/);
    expect(html).toMatch(/Fizetési határidő: 2026\. 06\. 15\./);
  });

  it("shows the VAT category instead of a percentage for an exempt line", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({ lineItems: [makeLineItem({ vatCategory: "AAM", vatRate: 0 })] })
    );
    expect(html).toContain(">AAM<");
    expect(html).toContain("Alanyi adómentes");
  });

  it("shows the reverse-charge notice for FAD lines", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({ lineItems: [makeLineItem({ vatCategory: "FAD", vatRate: 0 })] })
    );
    expect(html).toContain("Fordított adózás");
  });

  it("omits the exemption note block for an ordinary taxed invoice", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).not.toContain("Alanyi adómentes");
    expect(html).not.toContain("Fordított adózás");
  });

  it("falls back to Piszkozat (never DRAFT) when invoiceNumber is blank", () => {
    const html = generateInvoicePreviewHtml(makeInvoice({ invoiceNumber: "" }));
    expect(html).toContain("Piszkozat");
    expect(html).not.toContain("DRAFT");
  });

  it("contains none of the old English chrome strings", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).not.toContain("Bill to");
    expect(html).not.toContain("Description");
    expect(html).not.toContain("Qty");
    expect(html).not.toContain("Status:");
    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("DRAFT");
  });

  it("contains the Hungarian document labels, utf-8 meta and lang=hu", () => {
    const html = generateInvoicePreviewHtml(makeInvoice(), {
      company: { name: "Kovács Bt." },
    });
    expect(html).toContain("Számla");
    expect(html).toContain("Kibocsátó");
    expect(html).toContain("Vevő");
    expect(html).toContain("Megnevezés");
    expect(html).toContain("Mennyiség");
    expect(html).toContain("Egységár");
    expect(html).toContain("Nettó");
    expect(html).toContain("ÁFA");
    expect(html).toContain("Bruttó");
    expect(html).toContain("Fizetési határidő");
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('lang="hu"');
  });

  it("titles the document per documentType", () => {
    expect(generateInvoicePreviewHtml(makeInvoice({ documentType: "proforma" }))).toContain(
      "Díjbekérő"
    );
    expect(generateInvoicePreviewHtml(makeInvoice({ documentType: "storno" }))).toContain(
      "Sztornó számla"
    );
    expect(generateInvoicePreviewHtml(makeInvoice({ documentType: "modify" }))).toContain(
      "Helyesbítő számla"
    );
  });

  it("renders a status chip only for draft/paid, not for sent/unpaid", () => {
    expect(generateInvoicePreviewHtml(makeInvoice({ status: "draft" }))).toContain("Piszkozat");
    expect(generateInvoicePreviewHtml(makeInvoice({ status: "paid" }))).toContain("Fizetve");

    const sent = generateInvoicePreviewHtml(makeInvoice({ status: "sent" }));
    expect(sent).not.toContain("Kiküldve");

    const unpaid = generateInvoicePreviewHtml(makeInvoice({ status: "unpaid" }));
    expect(unpaid).not.toContain("Fizetetlen");
  });

  it("prints the issuer block (name, adószám, address, bank account) under Kibocsátó when a company is given", () => {
    const html = generateInvoicePreviewHtml(makeInvoice(), {
      company: {
        name: "Kovács Bt.",
        taxNumber: "11111111-1-11",
        address: "Fő u. 1.",
        city: "Budapest",
        bankAccount: "12345678-00000000-00000000",
      },
    });
    expect(html).toContain("Kovács Bt.");
    expect(html).toContain("11111111-1-11");
    expect(html).toContain("Fő u. 1.");
    expect(html).toContain("Budapest");
    expect(html).toContain("12345678-00000000-00000000");
  });

  it("omits the entire Kibocsátó card and renders no undefined/null when no company is given", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html).not.toContain("Kibocsátó");
    // The rest of the document still renders.
    expect(html).toContain("Vevő");
  });

  it("prints net, VAT amount and gross per line, formatted by formatDocumentAmount", () => {
    const invoice = makeInvoice({
      currency: "HUF",
      lineItems: [makeLineItem({ quantity: 2, unitPrice: 100, vatRate: 27 })],
    });
    const html = generateInvoicePreviewHtml(invoice);
    expect(html).toContain(formatDocumentAmount(200, "HUF"));
    expect(html).toContain(formatDocumentAmount(54, "HUF"));
    expect(html).toContain(formatDocumentAmount(254, "HUF"));
  });

  it("carries the InvoHub brand: navy, cornflower, footer wordmark, and responsive/print media blocks", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toContain("#111f4a");
    expect(html).toContain("#6495ed");
    expect(html).toContain("InvoHub");
    expect(html).toContain("@media (max-width: 560px)");
    expect(html).toContain("@media print");
  });
});
