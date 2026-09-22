// lib/invoices/preview-html.test.ts
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { documentLabels, formatDocumentAmount } from "@/lib/invoices/document-labels";
import { documentInk } from "@/lib/invoices/document-ink";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  type BrandShape,
} from "@/components/marketing/brand-mark-geometry";

describe("generateInvoicePreviewHtml", () => {
  it("includes invoice number and client", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("Acme Kft.");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("shows the buyer's address from the invoice snapshot (Áfa tv. 169. § e)", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({
        clientZipCode: "1011",
        clientCity: "Budapest",
        clientAddress: "Fő utca 1.",
      })
    );
    expect(html).toContain("1011 Budapest, Fő utca 1.");
  });

  it("falls back to an explicitly-passed buyer when the invoice snapshot is empty (legacy invoice)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice(), {
      buyer: { zipCode: "9021", city: "Győr", address: "Régi utca 2." },
    });
    expect(html).toContain("9021 Győr, Régi utca 2.");
  });

  it("shows the line item's unit next to the quantity when present", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({ lineItems: [makeLineItem({ quantity: 3, unit: "óra" })] })
    );
    expect(html).toContain("3 óra");
  });

  it("renders no address paragraph when neither the invoice snapshot nor an explicit buyer has one", () => {
    const html = generateInvoicePreviewHtml(makeInvoice({ clientTaxNumber: undefined }));
    // Buyer card has only the name paragraph — no stray empty <p></p>.
    expect(html).not.toMatch(/<p><\/p>/);
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

  it("sanitizes a malicious template.accentColor instead of interpolating it raw into the <style> block", () => {
    // accentColor is interpolated straight into a <style> block as
    // `--cornflower: ${accent}` — escapeHtml alone (which only escapes
    // & < > " ') can't stop CSS-syntax injection via ; } / * or
    // whitespace, so the value must be normalized to a strict #rrggbb
    // shape (or the default) before it ever reaches the template.
    const html = generateInvoicePreviewHtml(makeInvoice(), {
      template: {
        titleText: "SZÁMLA",
        accentColor: "red; } body { display: none; } /* pwned */",
        showCompanyBlock: true,
        showBankDetails: true,
        showClientTaxNumber: true,
        footerText: "",
        notesLabel: "Megjegyzés",
        fontScale: "medium",
      },
    });
    expect(html).not.toContain("pwned");
    expect(html).not.toContain("body { display: none");
    expect(html).toContain("--cornflower: #6495ed;");
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

  it("renders an inline brand-mark <svg> inside .footer, next to labels.footer (AC11)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    const footerMatch = html.match(/<div class="footer">([\s\S]*?)<\/div>/);
    expect(footerMatch).not.toBeNull();
    const footerHtml = footerMatch?.[1] ?? "";

    expect(footerHtml).toContain('<svg');
    expect(footerHtml).toContain('viewBox="0 0 48 48"');
    expect(footerHtml).toContain(documentLabels().footer);

    // Asserted against the imported constant, not a literal (AC11/AC13).
    const geometry = BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT];
    const allShapes: BrandShape[] = [...geometry.frame, ...geometry.flow];
    for (const shape of allShapes) {
      if (shape.kind === "path") {
        expect(footerHtml).toContain(shape.d);
      }
    }
  });

  it("marks the footer brand mark as a named image for assistive tech (AC12)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    const footerMatch = html.match(/<div class="footer">([\s\S]*?)<\/div>/);
    const footerHtml = footerMatch?.[1] ?? "";

    expect(footerHtml).toContain('role="img"');
    expect(footerHtml).toContain('aria-label="InvoHub"');
  });

  it("wraps the footer without overflow inside the existing mobile media block (AC12)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    const mobileBlockMatch = html.match(
      /@media \(max-width: 560px\) \{([\s\S]*?)\n {2}\}/
    );
    expect(mobileBlockMatch).not.toBeNull();
    expect(mobileBlockMatch?.[1] ?? "").toContain(".footer");
  });

  it("shows the exchange rate used and the VAT total in HUF for a EUR invoice (AC14)", () => {
    const html = generateInvoicePreviewHtml(
      makeInvoice({
        currency: "EUR",
        exchangeRate: 390.5,
        lineItems: [makeLineItem({ quantity: 2, unitPrice: 100, vatRate: 27 })],
      })
    );
    expect(html).toContain("390,5");
    expect(html).toContain(formatDocumentAmount(21087, "HUF"));
  });

  it("omits the exchange-rate/HUF-VAT block for a HUF invoice (AC14)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice({ currency: "HUF" }));
    expect(html).not.toContain("390,5");
    // Not a bare /HUF/ match: the Hungarianize/brand slice (merged first)
    // always prints a "Pénznem: HUF" currency line for a HUF invoice, so
    // that substring alone doesn't distinguish "no exchange-rate block" —
    // assert the absence of the exchange-rate-specific label instead.
    expect(html).not.toContain("ÁFA összege forintban");
  });
});

describe("generateInvoicePreviewHtml — muted ink contrast", () => {
  it("never emits the old sub-AA #8a90a6 ink (AC6)", () => {
    const defaultHtml = generateInvoicePreviewHtml(makeInvoice());
    expect(defaultHtml.toLowerCase()).not.toContain("#8a90a6");

    const enHtml = generateInvoicePreviewHtml(makeInvoice(), {
      locale: "en",
      template: { titleText: "CUSTOM INVOICE", accentColor: "#ff0000" },
    });
    expect(enHtml.toLowerCase()).not.toContain("#8a90a6");
  });

  it("inks the footer attribution with documentInk.muted (AC7)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    const footerRule = html.match(/\n\s*\.footer \{([^}]*)\}/)?.[1] ?? "";
    expect(footerRule).toContain("border-top");
    expect(footerRule).toContain(`color: ${documentInk.muted}`);
  });

  it("inks the mobile table data-labels with documentInk.muted (AC8)", () => {
    const html = generateInvoicePreviewHtml(makeInvoice());
    const mobileBlock =
      html.match(/@media \(max-width: 560px\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? "";
    const labelRule = mobileBlock.match(/td::before \{([^}]*)\}/)?.[1] ?? "";
    expect(labelRule).toContain(`color: ${documentInk.muted}`);
  });
});
