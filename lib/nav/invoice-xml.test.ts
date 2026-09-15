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

  it("omits <invoiceReference> for a plain CREATE (no invoiceReference passed)", () => {
    const xml = buildNavInvoiceXml(makeInvoice(), null);
    expect(xml).not.toContain("<invoiceReference>");
  });

  it("emits <invoiceReference> (originalInvoiceNumber/modifyWithoutMaster/modificationIndex, in that order) as the first child of <invoice>, before <invoiceHead>", () => {
    const invoice = makeInvoice({ documentType: "storno" });
    const xml = buildNavInvoiceXml(
      {
        ...invoice,
        invoiceReference: {
          originalInvoiceNumber: "INV-2026-099",
          modifyWithoutMaster: false,
          modificationIndex: 1,
        },
      },
      null
    );

    const referenceBlock = extractBlock(xml, "invoiceReference")!;
    expect(referenceBlock).toBeTruthy();
    expect(extractTag(referenceBlock, "originalInvoiceNumber")).toBe("INV-2026-099");
    expect(extractTag(referenceBlock, "modifyWithoutMaster")).toBe("false");
    expect(extractTag(referenceBlock, "modificationIndex")).toBe("1");

    // Element order inside <invoiceReference> matches InvoiceReferenceType's
    // xs:sequence (verified against the real invoiceData.xsd).
    const originalIdx = referenceBlock.indexOf("<originalInvoiceNumber>");
    const withoutMasterIdx = referenceBlock.indexOf("<modifyWithoutMaster>");
    const indexIdx = referenceBlock.indexOf("<modificationIndex>");
    expect(originalIdx).toBeGreaterThan(-1);
    expect(withoutMasterIdx).toBeGreaterThan(originalIdx);
    expect(indexIdx).toBeGreaterThan(withoutMasterIdx);

    // <invoiceReference> is the first child of <invoice>, before <invoiceHead>.
    expect(xml.indexOf("<invoiceReference>")).toBeLessThan(xml.indexOf("<invoiceHead>"));
  });

  it("renders modifyWithoutMaster=true when the original was never exchanged with NAV", () => {
    const xml = buildNavInvoiceXml(
      {
        ...makeInvoice({ documentType: "modify" }),
        invoiceReference: {
          originalInvoiceNumber: "INV-2026-001",
          modifyWithoutMaster: true,
          modificationIndex: 1,
        },
      },
      null
    );
    expect(extractTag(extractBlock(xml, "invoiceReference")!, "modifyWithoutMaster")).toBe("true");
  });
});

describe("buildNavInvoiceXml — non-HUF exchange rate (AC4-AC8)", () => {
  it("converts a EUR invoice's line/summary amounts to HUF using the stored rate, leaving the document-currency amounts untouched", () => {
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 390.5,
      lineItems: [{ id: "l1", description: "Tanácsadás", quantity: 2, unitPrice: 100, vatRate: 27, vatCategory: "normal" }],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    expect(extractTag(xml, "exchangeRate")).toBe("390.5");
    expect(extractTag(xml, "currencyCode")).toBe("EUR");

    const lineBlock = extractBlock(xml, "line")!;
    expect(extractTag(lineBlock, "lineNetAmount")).toBe("200.00");
    expect(extractTag(lineBlock, "lineNetAmountHUF")).toBe("78100.00");
    expect(extractTag(lineBlock, "lineVatAmount")).toBe("54.00");
    expect(extractTag(lineBlock, "lineVatAmountHUF")).toBe("21087.00");
    expect(extractTag(lineBlock, "lineGrossAmountNormalHUF")).toBe("99187.00");
  });

  it("keeps invoiceNetAmountHUF/invoiceVatAmountHUF equal to the exact sum of the per-line HUF values, per summaryByVatRate group too (AC5)", () => {
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 390.5,
      lineItems: [
        { id: "l1", description: "Item A", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" },
        { id: "l2", description: "Item B", quantity: 3, unitPrice: 50, vatRate: 5, vatCategory: "normal" },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    const lineHufAmounts = extractAllTags(xml, "lineNetAmountHUF").map(Number);
    const lineVatHufAmounts = extractAllTags(xml, "lineVatAmountHUF").map(Number);
    expect(lineHufAmounts).toHaveLength(2);
    expect(lineVatHufAmounts).toHaveLength(2);

    const netTotalHuf = lineHufAmounts.reduce((a, b) => a + b, 0);
    const vatTotalHuf = lineVatHufAmounts.reduce((a, b) => a + b, 0);

    expect(extractTag(xml, "invoiceNetAmountHUF")).toBe(netTotalHuf.toFixed(2));
    expect(extractTag(xml, "invoiceVatAmountHUF")).toBe(vatTotalHuf.toFixed(2));

    // Two distinct VAT rates -> two summaryByVatRate groups, each matching
    // its own line's HUF amounts exactly (single-line groups here).
    const groupNetHufAmounts = extractAllTags(xml, "vatRateNetAmountHUF");
    const groupVatHufAmounts = extractAllTags(xml, "vatRateVatAmountHUF");
    expect(groupNetHufAmounts).toEqual(
      lineHufAmounts.map((n) => n.toFixed(2))
    );
    expect(groupVatHufAmounts).toEqual(
      lineVatHufAmounts.map((n) => n.toFixed(2))
    );
  });

  it("is byte-for-byte unchanged for a HUF invoice — exchangeRate 1 and every …HUF element equal to its document-currency sibling (AC6)", () => {
    const invoice = makeInvoice({
      currency: "HUF",
      lineItems: [{ id: "l1", description: "Tanácsadás", quantity: 2, unitPrice: 10000, vatRate: 27, vatCategory: "normal" }],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    expect(extractTag(xml, "exchangeRate")).toBe("1");
    const lineBlock = extractBlock(xml, "line")!;
    expect(extractTag(lineBlock, "lineNetAmountHUF")).toBe(extractTag(lineBlock, "lineNetAmount")!);
    expect(extractTag(lineBlock, "lineVatAmountHUF")).toBe(extractTag(lineBlock, "lineVatAmount")!);
    expect(extractTag(lineBlock, "lineGrossAmountNormalHUF")).toBe(extractTag(lineBlock, "lineGrossAmountNormal")!);
    expect(extractTag(xml, "invoiceNetAmountHUF")).toBe(extractTag(xml, "invoiceNetAmount")!);
    expect(extractTag(xml, "invoiceVatAmountHUF")).toBe(extractTag(xml, "invoiceVatAmount")!);
    expect(extractTag(xml, "invoiceGrossAmountHUF")).toBe(extractTag(xml, "invoiceGrossAmount")!);
  });

  it("throws for a non-HUF invoice with no exchange rate, naming the invoice number and saying the rate is missing (AC7)", () => {
    const invoice = makeInvoice({
      invoiceNumber: "INV-2026-777",
      currency: "EUR",
      exchangeRate: undefined,
    });
    expect(() => buildNavInvoiceXml(invoice, null)).toThrow(/INV-2026-777/);
    expect(() => buildNavInvoiceXml(invoice, null)).toThrow(/exchange rate.*missing/i);
  });

  it("throws for a non-HUF invoice with exchange rate 0 (AC7)", () => {
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: 0 });
    expect(() => buildNavInvoiceXml(invoice, null)).toThrow(/exchange rate.*missing/i);
  });

  it("emits vatRateVatAmountHUF 0.00 and a non-zero vatRateNetAmountHUF for an AAM line on a EUR invoice (AC8)", () => {
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 390.5,
      lineItems: [
        {
          id: "aam-line",
          description: "Alanyi adómentes szolgáltatás",
          quantity: 1,
          unitPrice: 100,
          vatRate: 0,
          vatCategory: "AAM",
        },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);

    const summaryBlock = extractBlock(xml, "summaryByVatRate")!;
    expect(extractTag(summaryBlock, "vatRateVatAmountHUF")).toBe("0.00");
    expect(extractTag(summaryBlock, "vatRateNetAmountHUF")).toBe("39050.00");
  });
});
