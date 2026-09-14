// lib/nav/invoice-xml.test.ts
import { buildNavInvoiceXml } from "@/lib/nav/invoice-xml";
import { extractAllTags, extractBlock, extractTag } from "@/lib/nav/xml-utils";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("buildNavInvoiceXml", () => {
  it("builds a schema-shaped OSA 3.0 InvoiceData document", () => {
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
      city: "Budapest",
      zipCode: "1052",
      bankAccount: "12345678-12345678",
      createdAt: "",
      updatedAt: "",
    });

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('xmlns="http://schemas.nav.gov.hu/OSA/3.0/data"');
    expect(xml).toContain('xmlns:base="http://schemas.nav.gov.hu/OSA/3.0/base"');
    expect(xml).toContain("<InvoiceData");
    expect(extractTag(xml, "invoiceNumber")).toBe("INV-2026-001");

    const supplierBlock = extractBlock(xml, "supplierInfo")!;
    expect(extractTag(supplierBlock, "taxpayerId")).toBe("87654321");
    expect(extractTag(supplierBlock, "supplierName")).toBe("Demo Kft.");
    expect(extractTag(supplierBlock, "city")).toBe("Budapest");
    expect(extractTag(supplierBlock, "postalCode")).toBe("1052");
    expect(extractTag(supplierBlock, "supplierBankAccountNumber")).toBe("12345678-12345678");

    const customerBlock = extractBlock(xml, "customerInfo")!;
    expect(extractTag(customerBlock, "customerVatStatus")).toBe("DOMESTIC");
    expect(extractTag(customerBlock, "taxpayerId")).toBe("12345678");
    expect(extractTag(customerBlock, "customerName")).toBe("Test Client Kft.");

    // One <line> per line item, with the required amount blocks.
    const lineCount = (xml.match(/<line>/g) ?? []).length;
    expect(lineCount).toBe(invoice.lineItems.length);
    expect(xml).toContain("<lineNetAmountData>");
    expect(xml).toContain("<lineVatRate>");
    expect(xml).toContain("<lineGrossAmountData>");

    expect(xml).toContain("<invoiceSummary>");
    expect(xml).toContain("<summaryNormal>");
    expect(xml).toContain("<summaryGrossData>");
  });

  it("marks a customer with no tax number as PRIVATE_PERSON and omits customerVatData", () => {
    const invoice = makeInvoice({ clientName: "Magánszemély", clientTaxNumber: undefined });
    const xml = buildNavInvoiceXml(invoice, null);
    const customerBlock = extractBlock(xml, "customerInfo")!;
    expect(extractTag(customerBlock, "customerVatStatus")).toBe("PRIVATE_PERSON");
    expect(customerBlock).not.toContain("customerVatData");
  });

  it("escapes XML special characters", () => {
    const invoice = makeInvoice({ clientName: "A & B <C>" });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(xml).toContain("A &amp; B &lt;C&gt;");
  });

  it("falls back to a placeholder supplier tax number when the company has none", () => {
    const invoice = makeInvoice();
    const xml = buildNavInvoiceXml(invoice, null);
    const supplierBlock = extractBlock(xml, "supplierInfo")!;
    expect(extractTag(supplierBlock, "taxpayerId")).toBe("00000000");
  });

  it("emits vatPercentage as a 0..1 decimal per VAT rate group", () => {
    const invoice = makeInvoice({
      lineItems: [
        { id: "l1", description: "Item A", quantity: 1, unitPrice: 1000, vatRate: 27 },
        { id: "l2", description: "Item B", quantity: 2, unitPrice: 500, vatRate: 5 },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(xml).toContain("<vatPercentage>0.2700</vatPercentage>");
    expect(xml).toContain("<vatPercentage>0.0500</vatPercentage>");
    // Two distinct VAT rates -> two summaryByVatRate groups.
    expect(extractAllTags(xml, "vatPercentage").length).toBeGreaterThanOrEqual(4); // 2 lines + 2 summary groups
  });

  it("accepts an optional per-line vatExemption (e.g. AAM) and zeroes the VAT amount", () => {
    const invoice = makeInvoice({
      lineItems: [{ id: "aam-line", description: "Alanyi adómentes szolgáltatás", quantity: 1, unitPrice: 10000, vatRate: 0 }],
    });
    const xml = buildNavInvoiceXml(invoice, null, {
      "aam-line": { vatExemption: { case: "AAM", reason: "Alanyi adómentesség" } },
    });

    expect(xml).toContain("<vatExemption>");
    expect(xml).toContain("<case>AAM</case>");
    expect(xml).toContain("<reason>Alanyi adómentesség</reason>");
    expect(xml).not.toContain("<vatPercentage>");
    expect(xml).toContain("<lineVatAmount>0.00</lineVatAmount>");
    expect(xml).toContain("<invoiceVatAmount>0.00</invoiceVatAmount>");
    expect(xml).toContain("<invoiceGrossAmount>10000.00</invoiceGrossAmount>");
  });

  it("derives vatExemption automatically from InvoiceLineItem.vatCategory (AAM), no lineExtras needed", () => {
    const invoice = makeInvoice({
      lineItems: [
        {
          id: "aam-line",
          description: "Alanyi adómentes szolgáltatás",
          quantity: 1,
          unitPrice: 10000,
          vatRate: 0,
          vatCategory: "AAM",
        },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    expect(xml).toContain("<vatExemption>");
    expect(xml).toContain("<case>AAM</case>");
    expect(xml).toContain("<reason>Alanyi adómentes</reason>");
    expect(xml).not.toContain("<vatPercentage>");
    expect(xml).toContain("<lineVatAmount>0.00</lineVatAmount>");
  });

  it("uses an explicit lineExtras override instead of the derived vatCategory treatment", () => {
    const invoice = makeInvoice({
      lineItems: [
        {
          id: "aam-line",
          description: "Alanyi adómentes szolgáltatás",
          quantity: 1,
          unitPrice: 10000,
          vatRate: 0,
          vatCategory: "AAM",
        },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null, {
      "aam-line": { vatExemption: { case: "CUSTOM", reason: "Manual override" } },
    });

    expect(xml).toContain("<case>CUSTOM</case>");
    expect(xml).toContain("<reason>Manual override</reason>");
    expect(xml).not.toContain("<case>AAM</case>");
  });

  it("maps vatCategory FAD (domestic reverse charge) to vatDomesticReverseCharge, not vatExemption", () => {
    const invoice = makeInvoice({
      lineItems: [
        {
          id: "fad-line",
          description: "Fordított adózás alá eső szolgáltatás",
          quantity: 1,
          unitPrice: 5000,
          vatRate: 0,
          vatCategory: "FAD",
        },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    expect(xml).toContain("<vatDomesticReverseCharge>true</vatDomesticReverseCharge>");
    expect(xml).not.toContain("<vatExemption>");
    expect(xml).toContain("<lineVatAmount>0.00</lineVatAmount>");
    expect(xml).toContain("<lineGrossAmountNormal>5000.00</lineGrossAmountNormal>");
  });

  it("maps vatCategory ATK (outside the scope of VAT) to vatOutOfScope", () => {
    const invoice = makeInvoice({
      lineItems: [
        {
          id: "atk-line",
          description: "Áfa hatályán kívüli tétel",
          quantity: 1,
          unitPrice: 3000,
          vatRate: 0,
          vatCategory: "ATK",
        },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    expect(xml).toContain("<vatOutOfScope>");
    expect(xml).toContain("<case>ATK</case>");
    expect(xml).not.toContain("<vatExemption>");
  });

  it("supports overriding invoiceAppearance and invoiceDeliveryDate", () => {
    const invoice = makeInvoice({ issueDate: "2026-05-01" });
    const xml = buildNavInvoiceXml(
      { ...invoice, invoiceAppearance: "ELECTRONIC", invoiceDeliveryDate: "2026-05-03" },
      null
    );
    expect(extractTag(xml, "invoiceAppearance")).toBe("ELECTRONIC");
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("2026-05-03");
  });
});
