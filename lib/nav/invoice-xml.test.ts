// lib/nav/invoice-xml.test.ts
import { buildNavInvoiceXml } from "@/lib/nav/invoice-xml";
import { extractAllTags, extractBlock, extractTag } from "@/lib/nav/xml-utils";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { PAYMENT_METHODS } from "@/lib/invoices/payment-status";

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
      // SimpleAddressType needs all of country/postal/city/additionalAddressDetail.
      address: "Andrássy út 1.",
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

  // AC5: fulfillmentDate drives invoiceDeliveryDate.
  it("uses invoice.fulfillmentDate for invoiceDeliveryDate when set", () => {
    const invoice = makeInvoice({ issueDate: "2026-05-01", fulfillmentDate: "2026-05-02" });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("2026-05-02");
  });

  it("still lets an explicit NavInvoiceExtra.invoiceDeliveryDate override fulfillmentDate", () => {
    const invoice = makeInvoice({ issueDate: "2026-05-01", fulfillmentDate: "2026-05-02" });
    const xml = buildNavInvoiceXml(
      { ...invoice, invoiceDeliveryDate: "2026-05-03" },
      null
    );
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("2026-05-03");
  });

  it("falls back to issueDate when neither invoiceDeliveryDate nor fulfillmentDate are set", () => {
    const invoice = makeInvoice({ issueDate: "2026-05-01", fulfillmentDate: undefined });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("2026-05-01");
  });

  it("date-normalizes a fulfillmentDate that carries a time part", () => {
    const invoice = makeInvoice({
      issueDate: "2026-05-01",
      fulfillmentDate: "2026-05-02T09:00:00Z",
    });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("2026-05-02");
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

  it("emits exactly one <paymentMethod>TRANSFER</paymentMethod> inside <invoiceDetail> for a transfer invoice", () => {
    const xml = buildNavInvoiceXml(makeInvoice({ paymentMethod: "transfer" }), null);
    const detailBlock = extractBlock(xml, "invoiceDetail")!;
    expect(extractAllTags(detailBlock, "paymentMethod")).toEqual(["TRANSFER"]);
  });

  it("orders invoiceDetail children per InvoiceDetailType's xs:sequence: currencyCode < exchangeRate < paymentMethod < paymentDate < invoiceAppearance", () => {
    const xml = buildNavInvoiceXml(makeInvoice({ paymentMethod: "cash" }), null);
    const detailBlock = extractBlock(xml, "invoiceDetail")!;
    const currencyIdx = detailBlock.indexOf("<currencyCode>");
    const exchangeIdx = detailBlock.indexOf("<exchangeRate>");
    const paymentMethodIdx = detailBlock.indexOf("<paymentMethod>");
    const paymentDateIdx = detailBlock.indexOf("<paymentDate>");
    const appearanceIdx = detailBlock.indexOf("<invoiceAppearance>");

    expect(currencyIdx).toBeGreaterThan(-1);
    expect(exchangeIdx).toBeGreaterThan(currencyIdx);
    expect(paymentMethodIdx).toBeGreaterThan(exchangeIdx);
    expect(paymentDateIdx).toBeGreaterThan(paymentMethodIdx);
    expect(appearanceIdx).toBeGreaterThan(paymentDateIdx);
  });

  it("omits <paymentMethod> when the invoice has no paymentMethod, while paymentDate and invoiceAppearance stay present", () => {
    const xml = buildNavInvoiceXml(makeInvoice({ paymentMethod: undefined }), null);
    expect(xml).not.toContain("<paymentMethod>");
    expect(extractTag(xml, "paymentDate")).not.toBeNull();
    expect(extractTag(xml, "invoiceAppearance")).not.toBeNull();
  });

  it.each(PAYMENT_METHODS)(
    "maps InvoHub paymentMethod %s to its NAV enum end-to-end through the builder",
    (method) => {
      const expected: Record<(typeof PAYMENT_METHODS)[number], string> = {
        transfer: "TRANSFER",
        cash: "CASH",
        card: "CARD",
        other: "OTHER",
      };
      const xml = buildNavInvoiceXml(makeInvoice({ paymentMethod: method }), null);
      expect(extractTag(xml, "paymentMethod")).toBe(expected[method]);
    }
  );

  it("emits paymentDate as the due date, never the actual payment date (paidAt)", () => {
    const xml = buildNavInvoiceXml(
      makeInvoice({ dueDate: "2026-06-15", paidAt: "2026-06-03T08:00:00.000Z" }),
      null
    );
    expect(extractTag(xml, "paymentDate")).toBe("2026-06-15");
    expect(xml).not.toContain("2026-06-03");
    expect(xml).not.toContain("2026-06-03T08:00:00.000Z");
  });

  it("normalizes a due date with a time component to a date-only paymentDate", () => {
    const xml = buildNavInvoiceXml(makeInvoice({ dueDate: "2026-06-15T12:30:00.000Z" }), null);
    expect(extractTag(xml, "paymentDate")).toBe("2026-06-15");
  });

  it("omits <paymentDate> entirely when dueDate is empty, without disturbing paymentMethod/invoiceAppearance", () => {
    const xml = buildNavInvoiceXml(
      makeInvoice({ dueDate: "", paymentMethod: "card" }),
      null
    );
    expect(xml).not.toContain("<paymentDate>");
    const detailBlock = extractBlock(xml, "invoiceDetail")!;
    const paymentMethodIdx = detailBlock.indexOf("<paymentMethod>");
    const appearanceIdx = detailBlock.indexOf("<invoiceAppearance>");
    expect(paymentMethodIdx).toBeGreaterThan(-1);
    expect(appearanceIdx).toBeGreaterThan(paymentMethodIdx);
  });

  it("date-normalizes invoiceIssueDate and invoiceDeliveryDate the same way as paymentDate", () => {
    const xml = buildNavInvoiceXml(
      makeInvoice({ issueDate: "2026-05-01T09:00:00Z" }),
      null
    );
    expect(extractTag(xml, "invoiceIssueDate")).toBe("2026-05-01");
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("2026-05-01");
  });

  it("falls back to today's raw escaped string for invoiceIssueDate/invoiceDeliveryDate when unparseable (mandatory elements, never omitted)", () => {
    const invoice = makeInvoice({ issueDate: "not-a-date" });
    const xml = buildNavInvoiceXml(invoice, null);
    expect(extractTag(xml, "invoiceIssueDate")).toBe("not-a-date");
    expect(extractTag(xml, "invoiceDeliveryDate")).toBe("not-a-date");
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

describe("buildNavInvoiceXml — merge regression: non-HUF exchange rate + paymentMethod/paymentDate together", () => {
  // PR #13 (exchange rate) and PR #14 (paymentMethod/paymentDate) both
  // rewrote the same <invoiceDetail> template literal independently. A
  // naive merge could easily drop one side's element or scramble the
  // schema order once both features are exercised on the same invoice —
  // this pins the combination neither original PR's own tests covered.
  it("emits currencyCode, exchangeRate, paymentMethod and paymentDate together, in verified schema order, for a non-HUF invoice with a payment method and a paid date set", () => {
    const invoice = makeInvoice({
      currency: "EUR",
      exchangeRate: 390.5,
      paymentMethod: "card",
      dueDate: "2026-06-15",
      paidAt: "2026-06-03T08:00:00.000Z",
      lineItems: [
        { id: "l1", description: "Tanácsadás", quantity: 2, unitPrice: 100, vatRate: 27, vatCategory: "normal" },
      ],
    });
    const xml = buildNavInvoiceXml(invoice, null);
    const detailBlock = extractBlock(xml, "invoiceDetail")!;

    // All four elements present with the right values.
    expect(extractTag(detailBlock, "currencyCode")).toBe("EUR");
    expect(extractTag(detailBlock, "exchangeRate")).toBe("390.5");
    expect(extractTag(detailBlock, "paymentMethod")).toBe("CARD");
    expect(extractTag(detailBlock, "paymentDate")).toBe("2026-06-15");

    // paymentDate is still the due date, never the actual payment date —
    // the exchange-rate slice's rate must not disturb that mapping.
    expect(xml).not.toContain("2026-06-03");

    // Schema-verified InvoiceDetailType sequence order: currencyCode <
    // exchangeRate < paymentMethod < paymentDate < invoiceAppearance.
    const currencyIdx = detailBlock.indexOf("<currencyCode>");
    const exchangeIdx = detailBlock.indexOf("<exchangeRate>");
    const paymentMethodIdx = detailBlock.indexOf("<paymentMethod>");
    const paymentDateIdx = detailBlock.indexOf("<paymentDate>");
    const appearanceIdx = detailBlock.indexOf("<invoiceAppearance>");
    expect(currencyIdx).toBeGreaterThan(-1);
    expect(exchangeIdx).toBeGreaterThan(currencyIdx);
    expect(paymentMethodIdx).toBeGreaterThan(exchangeIdx);
    expect(paymentDateIdx).toBeGreaterThan(paymentMethodIdx);
    expect(appearanceIdx).toBeGreaterThan(paymentDateIdx);

    // The HUF conversion (exchange-rate slice) still works correctly
    // alongside the payment fields (payment-method slice) on the same line.
    const lineBlock = extractBlock(xml, "line")!;
    expect(extractTag(lineBlock, "lineNetAmountHUF")).toBe("78100.00");
  });
});
