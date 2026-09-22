// __tests__/helpers/nav-xml-structure.ts
// Structural checks for generated NAV OSA 3.0 InvoiceData XML. The repo has
// no XSD validator (and tests must never call NAV's own validation), so
// these helpers parse the document with @xmldom/xmldom (already in the
// dependency tree via Expo) to prove well-formedness, then assert child
// element order against the xs:sequence definitions of invoiceData.xsd /
// invoiceBase.xsd (nav-gov-hu/Online-Invoice, fetched 2026-09-22).
import { DOMParser } from "@xmldom/xmldom";

type XmlElement = {
  localName: string;
  childNodes: ArrayLike<{ nodeType: number }>;
  getElementsByTagNameNS(ns: string, name: string): ArrayLike<XmlElement>;
  textContent: string | null;
};

export const NS_DATA = "http://schemas.nav.gov.hu/OSA/3.0/data";
export const NS_BASE = "http://schemas.nav.gov.hu/OSA/3.0/base";

/** Parses and throws on any well-formedness error/warning. */
export function parseNavXml(xml: string): XmlElement {
  const errors: string[] = [];
  const doc = new DOMParser({
    onError: (level: string, msg: string) => {
      if (level !== "warning") errors.push(`${level}: ${msg}`);
    },
  } as never).parseFromString(xml, "text/xml");
  if (errors.length > 0) throw new Error(`Malformed NAV XML: ${errors.join("; ")}`);
  return doc.documentElement as unknown as XmlElement;
}

export function childNames(element: XmlElement): string[] {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === 1)
    .map((node) => (node as unknown as XmlElement).localName);
}

export function firstElement(root: XmlElement, localName: string, ns = NS_DATA): XmlElement | null {
  const found = root.getElementsByTagNameNS(ns, localName);
  return found.length > 0 ? found[0] : null;
}

export function allElements(root: XmlElement, localName: string, ns = NS_DATA): XmlElement[] {
  return Array.from(root.getElementsByTagNameNS(ns, localName));
}

/**
 * Asserts `actual` is an in-order subsequence of `sequence` (xs:sequence
 * semantics for optional elements: any may be absent, none may be out of
 * order or unknown).
 */
export function expectSequence(actual: string[], sequence: string[]): void {
  let cursor = 0;
  for (const name of actual) {
    const index = sequence.indexOf(name, cursor);
    if (index === -1) {
      throw new Error(`Element <${name}> is unknown or out of order. Got [${actual.join(", ")}], schema order [${sequence.join(", ")}].`);
    }
    cursor = index + 1;
  }
}

export const CUSTOMER_INFO_SEQUENCE = [
  "customerVatStatus",
  "customerVatData",
  "customerName",
  "customerAddress",
  "customerBankAccountNumber",
];

export const SUPPLIER_INFO_SEQUENCE = [
  "supplierTaxNumber",
  "groupMemberTaxNumber",
  "communityVatNumber",
  "supplierName",
  "supplierAddress",
  "supplierBankAccountNumber",
];

export const SIMPLE_ADDRESS_SEQUENCE = ["countryCode", "region", "postalCode", "city", "additionalAddressDetail"];

export const TAX_NUMBER_SEQUENCE = ["taxpayerId", "vatCode", "countyCode"];

export const LINE_SEQUENCE = [
  "lineNumber",
  "lineModificationReference",
  "referencesToOtherLines",
  "advanceData",
  "productCodes",
  "lineExpressionIndicator",
  "lineNatureIndicator",
  "lineDescription",
  "quantity",
  "unitOfMeasure",
  "unitOfMeasureOwn",
  "unitPrice",
  "unitPriceHUF",
  "lineDiscountData",
  "lineAmountsNormal",
  "lineAmountsSimplified",
];

export const NAV_UNIT_OF_MEASURE_ENUM = [
  "PIECE", "KILOGRAM", "TON", "KWH", "DAY", "HOUR", "MINUTE", "MONTH", "LITER",
  "KILOMETER", "CUBIC_METER", "METER", "LINEAR_METER", "CARTON", "PACK", "OWN",
];
