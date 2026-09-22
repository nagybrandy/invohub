// lib/nav/invoice-xml.customer.test.ts
// customerInfo / supplier address / unitOfMeasure / modification-line /
// advance-line structure of the generated OSA 3.0 InvoiceData, parsed and
// checked against the XSD's xs:sequence order for every customer type.
import { buildNavInvoiceXml } from "@/lib/nav/invoice-xml";
import { deriveNavCustomer } from "@/lib/nav/customer";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import { buildModificationDraftLineItems } from "@/lib/invoices/modification-lines";
import {
  CUSTOMER_INFO_SEQUENCE,
  LINE_SEQUENCE,
  NAV_UNIT_OF_MEASURE_ENUM,
  NS_BASE,
  SIMPLE_ADDRESS_SEQUENCE,
  SUPPLIER_INFO_SEQUENCE,
  TAX_NUMBER_SEQUENCE,
  allElements,
  childNames,
  expectSequence,
  firstElement,
  parseNavXml,
} from "@/__tests__/helpers/nav-xml-structure";
import type { Company } from "@/lib/companies/service";

const company: Company = {
  id: "c1",
  userId: "u1",
  name: "Minta EV",
  taxNumber: "87654321-1-41",
  address: "Fő utca 2.",
  city: "Budapest",
  zipCode: "1011",
  country: "Magyarország",
  createdAt: "",
  updatedAt: "",
};

const HU_ADDRESS = { country: "HU", postalCode: "1052", city: "Budapest", street: "Váci utca 1." };

function customerInfoOf(xml: string) {
  const root = parseNavXml(xml);
  const info = firstElement(root, "customerInfo");
  if (!info) throw new Error("no customerInfo");
  return { root, info };
}

describe("buildNavInvoiceXml — customerInfo per customer type", () => {
  it("DOMESTIC: tax number (taxpayerId/vatCode/countyCode), name and simpleAddress, in schema order", () => {
    const invoice = makeInvoice({ clientName: "Acme Kft.", clientTaxNumber: "12345678-2-42" });
    const customer = deriveNavCustomer({ name: "Acme Kft.", taxNumber: "12345678-2-42", address: HU_ADDRESS });
    const { info } = customerInfoOf(buildNavInvoiceXml({ ...invoice, customer }, company));

    expect(childNames(info)).toEqual(["customerVatStatus", "customerVatData", "customerName", "customerAddress"]);
    expectSequence(childNames(info), CUSTOMER_INFO_SEQUENCE);
    expect(firstElement(info, "customerVatStatus")!.textContent).toBe("DOMESTIC");

    const taxNumber = firstElement(info, "customerTaxNumber")!;
    expectSequence(childNames(taxNumber), TAX_NUMBER_SEQUENCE);
    expect(firstElement(taxNumber, "taxpayerId", NS_BASE)!.textContent).toBe("12345678");
    expect(firstElement(taxNumber, "vatCode", NS_BASE)!.textContent).toBe("2");
    expect(firstElement(taxNumber, "countyCode", NS_BASE)!.textContent).toBe("42");

    const address = firstElement(info, "simpleAddress")!;
    expect(childNames(address)).toEqual(["countryCode", "postalCode", "city", "additionalAddressDetail"]);
    expectSequence(childNames(address), SIMPLE_ADDRESS_SEQUENCE);
    expect(firstElement(address, "countryCode", NS_BASE)!.textContent).toBe("HU");
    expect(firstElement(address, "postalCode", NS_BASE)!.textContent).toBe("1052");
    expect(firstElement(address, "city", NS_BASE)!.textContent).toBe("Budapest");
    expect(firstElement(address, "additionalAddressDetail", NS_BASE)!.textContent).toBe("Váci utca 1.");
  });

  it("PRIVATE_PERSON: only customerVatStatus — no vat data, name or address", () => {
    const invoice = makeInvoice({ clientName: "Kiss Anna", clientTaxNumber: undefined });
    const customer = deriveNavCustomer({ name: "Kiss Anna", partyType: "private_person", address: HU_ADDRESS });
    const { info } = customerInfoOf(buildNavInvoiceXml({ ...invoice, customer }, company));

    expect(childNames(info)).toEqual(["customerVatStatus"]);
    expect(firstElement(info, "customerVatStatus")!.textContent).toBe("PRIVATE_PERSON");
  });

  it("PRIVATE_PERSON without a derived customer (legacy call path) still sends no name", () => {
    const xml = buildNavInvoiceXml(makeInvoice({ clientName: "Magánszemély", clientTaxNumber: undefined }), null);
    const { info } = customerInfoOf(xml);
    expect(childNames(info)).toEqual(["customerVatStatus"]);
    expect(xml).not.toContain("Magánszemély");
  });

  it("OTHER (EU): communityVatNumber, name and foreign address", () => {
    const customer = deriveNavCustomer({
      name: "Muster GmbH",
      euVatNumber: "DE123456789",
      address: { country: "Németország", postalCode: "10115", city: "Berlin", street: "Hauptstr. 1" },
    });
    const invoice = makeInvoice({ clientName: "Muster GmbH", clientTaxNumber: undefined });
    const { info } = customerInfoOf(buildNavInvoiceXml({ ...invoice, customer }, company));

    expect(childNames(info)).toEqual(["customerVatStatus", "customerVatData", "customerName", "customerAddress"]);
    expect(firstElement(info, "customerVatStatus")!.textContent).toBe("OTHER");
    expect(childNames(firstElement(info, "customerVatData")!)).toEqual(["communityVatNumber"]);
    expect(firstElement(info, "communityVatNumber")!.textContent).toBe("DE123456789");
    expect(firstElement(info, "countryCode", NS_BASE)!.textContent).toBe("DE");
  });

  it("OTHER (third country): thirdStateTaxId, name and address", () => {
    const customer = deriveNavCustomer({
      name: "Example Inc.",
      taxNumber: "12-3456789",
      address: { country: "US", postalCode: "10001", city: "New York", street: "5th Ave 1" },
    });
    const { info } = customerInfoOf(buildNavInvoiceXml({ ...makeInvoice(), customer }, company));
    expect(childNames(firstElement(info, "customerVatData")!)).toEqual(["thirdStateTaxId"]);
    expect(firstElement(info, "thirdStateTaxId")!.textContent).toBe("12-3456789");
    expect(firstElement(info, "customerName")!.textContent).toBe("Example Inc.");
  });

  it("OTHER without tax data (domestic non-VAT-subject company): no customerVatData, name + address kept", () => {
    const customer = deriveNavCustomer({ name: "Horgász Egyesület", partyType: "company", address: HU_ADDRESS });
    const { info } = customerInfoOf(buildNavInvoiceXml({ ...makeInvoice(), customer }, company));
    expect(childNames(info)).toEqual(["customerVatStatus", "customerName", "customerAddress"]);
  });

  it("omits customerAddress when the partner address is incomplete (never a half-filled simpleAddress)", () => {
    const customer = deriveNavCustomer({ name: "Acme Kft.", taxNumber: "12345678-2-42", address: { city: "Budapest" } });
    const { info } = customerInfoOf(buildNavInvoiceXml({ ...makeInvoice(), customer }, company));
    expect(childNames(info)).toEqual(["customerVatStatus", "customerVatData", "customerName"]);
  });
});

describe("buildNavInvoiceXml — supplierInfo", () => {
  it("derives vatCode/countyCode from the company's adószám (an alanyi adómentes EV is vatCode 1, not a hardcoded 2)", () => {
    const root = parseNavXml(buildNavInvoiceXml(makeInvoice(), company));
    const supplier = firstElement(root, "supplierInfo")!;
    expectSequence(childNames(supplier), SUPPLIER_INFO_SEQUENCE);
    const taxNumber = firstElement(supplier, "supplierTaxNumber")!;
    expect(childNames(taxNumber)).toEqual(["taxpayerId", "vatCode", "countyCode"]);
    expect(firstElement(taxNumber, "vatCode", NS_BASE)!.textContent).toBe("1");
    expect(firstElement(taxNumber, "countyCode", NS_BASE)!.textContent).toBe("41");
  });

  it("emits a complete supplier simpleAddress with an ISO country code and the street as additionalAddressDetail", () => {
    const root = parseNavXml(buildNavInvoiceXml(makeInvoice(), company));
    const address = firstElement(firstElement(root, "supplierInfo")!, "simpleAddress")!;
    expect(childNames(address)).toEqual(["countryCode", "postalCode", "city", "additionalAddressDetail"]);
    expect(firstElement(address, "countryCode", NS_BASE)!.textContent).toBe("HU");
    expect(firstElement(address, "additionalAddressDetail", NS_BASE)!.textContent).toBe("Fő utca 2.");
  });

  it("omits the supplier address rather than emitting one without a street", () => {
    const xml = buildNavInvoiceXml(makeInvoice(), { ...company, address: undefined });
    expect(firstElement(parseNavXml(xml), "supplierAddress")).toBeNull();
  });
});

describe("buildNavInvoiceXml — unitOfMeasure", () => {
  it("maps each line's unit onto the NAV enum and uses OWN + unitOfMeasureOwn only for units NAV has no value for", () => {
    const invoice = makeInvoice({
      lineItems: [
        makeLineItem({ id: "l1", unit: "óra" }),
        makeLineItem({ id: "l2", unit: "db" }),
        makeLineItem({ id: "l3", unit: "hó" }),
        makeLineItem({ id: "l4", unit: "m²" }),
        makeLineItem({ id: "l5", unit: undefined }),
      ],
    });
    const root = parseNavXml(buildNavInvoiceXml(invoice, company));
    const lines = allElements(root, "line");
    expect(lines.map((line) => firstElement(line, "unitOfMeasure")!.textContent)).toEqual([
      "HOUR",
      "PIECE",
      "MONTH",
      "OWN",
      "PIECE",
    ]);
    for (const line of lines) {
      expect(NAV_UNIT_OF_MEASURE_ENUM).toContain(firstElement(line, "unitOfMeasure")!.textContent);
      expectSequence(childNames(line), LINE_SEQUENCE);
    }
    expect(allElements(root, "unitOfMeasureOwn").map((el) => el.textContent)).toEqual(["m²"]);
  });
});

describe("buildNavInvoiceXml — modification documents (storno / helyesbítő)", () => {
  const reference = { originalInvoiceNumber: "INV-2026-010", modifyWithoutMaster: false, modificationIndex: 1 };

  it("adds lineModificationReference (lineNumberReference = base + n, lineOperation CREATE) right after lineNumber", () => {
    const invoice = makeInvoice({
      documentType: "storno",
      lineItems: [makeLineItem({ id: "a", quantity: -1 }), makeLineItem({ id: "b", quantity: -2 })],
    });
    const root = parseNavXml(
      buildNavInvoiceXml({ ...invoice, invoiceReference: reference, lineNumberReferenceBase: 3 }, company)
    );
    const lines = allElements(root, "line");
    expect(lines).toHaveLength(2);
    lines.forEach((line, index) => {
      expect(childNames(line).slice(0, 2)).toEqual(["lineNumber", "lineModificationReference"]);
      expectSequence(childNames(line), LINE_SEQUENCE);
      const ref = firstElement(line, "lineModificationReference")!;
      expect(childNames(ref)).toEqual(["lineNumberReference", "lineOperation"]);
      expect(firstElement(ref, "lineNumberReference")!.textContent).toBe(String(3 + index + 1));
      expect(firstElement(ref, "lineOperation")!.textContent).toBe("CREATE");
    });
  });

  it("helyesbítő difference lines: reversal + corrected copy go out as consecutive CREATE lines with signed amounts", () => {
    const original = [
      makeLineItem({ id: "a", description: "Tanácsadás", quantity: 3, unit: "óra", unitPrice: 10000, vatRate: 27 }),
      makeLineItem({ id: "b", description: "Könyv", quantity: 1, unit: "db", unitPrice: 5000, vatRate: 5 }),
    ];
    const lines = buildModificationDraftLineItems(original);
    // User corrected the hours from 3 to 4; the book pair stays (nets to 0).
    lines[1] = { ...lines[1], quantity: 4 };
    const invoice = makeInvoice({ documentType: "modify", currency: "HUF", lineItems: lines });
    const root = parseNavXml(
      buildNavInvoiceXml({ ...invoice, invoiceReference: reference, lineNumberReferenceBase: 2 }, company)
    );

    const xmlLines = allElements(root, "line");
    expect(xmlLines).toHaveLength(4);
    expect(xmlLines.map((l) => firstElement(l, "lineNumber")!.textContent)).toEqual(["1", "2", "3", "4"]);
    expect(xmlLines.map((l) => firstElement(l, "lineNumberReference")!.textContent)).toEqual(["3", "4", "5", "6"]);
    expect(xmlLines.map((l) => firstElement(l, "lineOperation")!.textContent)).toEqual([
      "CREATE",
      "CREATE",
      "CREATE",
      "CREATE",
    ]);
    expect(xmlLines.map((l) => firstElement(l, "quantity")!.textContent)).toEqual(["-3.00", "4.00", "-1.00", "1.00"]);
    expect(xmlLines.map((l) => firstElement(l, "unitOfMeasure")!.textContent)).toEqual(["HOUR", "HOUR", "PIECE", "PIECE"]);
    expect(xmlLines.map((l) => firstElement(l, "lineNetAmount")!.textContent)).toEqual([
      "-30000.00",
      "40000.00",
      "-5000.00",
      "5000.00",
    ]);
    for (const line of xmlLines) expectSequence(childNames(line), LINE_SEQUENCE);

    // The document total is exactly the difference: +1 hour at 27%.
    expect(firstElement(root, "invoiceNetAmount")!.textContent).toBe("10000.00");
    expect(firstElement(root, "invoiceVatAmount")!.textContent).toBe("2700.00");
    const byRate = allElements(root, "summaryByVatRate").map((el) => ({
      net: firstElement(el, "vatRateNetAmount")!.textContent,
      vat: firstElement(el, "vatRateVatAmount")!.textContent,
    }));
    expect(byRate).toEqual([
      { net: "10000.00", vat: "2700.00" },
      { net: "0.00", vat: "0.00" },
    ]);
  });

  it("a non-HUF helyesbítő pair nets to exactly 0 HUF, even on half-cent conversions", () => {
    const lines = buildModificationDraftLineItems([
      makeLineItem({ id: "a", quantity: 1, unitPrice: 0.125, vatRate: 27 }),
    ]);
    const invoice = makeInvoice({ documentType: "modify", currency: "EUR", exchangeRate: 1, lineItems: lines });
    const root = parseNavXml(
      buildNavInvoiceXml({ ...invoice, invoiceReference: reference, lineNumberReferenceBase: 1 }, company)
    );
    expect(firstElement(root, "invoiceNetAmountHUF")!.textContent).toBe("0.00");
    expect(firstElement(root, "invoiceVatAmountHUF")!.textContent).toBe("0.00");
  });

  it("does not add lineModificationReference to a plain CREATE invoice", () => {
    const xml = buildNavInvoiceXml(makeInvoice(), company);
    expect(xml).not.toContain("lineModificationReference");
  });
});

describe("buildNavInvoiceXml — advance (előleg) invoice", () => {
  it("marks every line of an előlegszámla with advanceData/advanceIndicator=true, in schema position", () => {
    const invoice = makeInvoice({ documentType: "advance" });
    const root = parseNavXml(buildNavInvoiceXml(invoice, company));
    for (const line of allElements(root, "line")) {
      expectSequence(childNames(line), LINE_SEQUENCE);
      expect(firstElement(firstElement(line, "advanceData")!, "advanceIndicator")!.textContent).toBe("true");
    }
  });

  it("does not add advanceData to a normal invoice", () => {
    expect(buildNavInvoiceXml(makeInvoice(), company)).not.toContain("advanceData");
  });
});
