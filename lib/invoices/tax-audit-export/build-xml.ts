// lib/invoices/tax-audit-export/build-xml.ts
// "Adóhatósági ellenőrzési adatszolgáltatás" XML — the audit export every
// számlázó program must offer under 23/2014. (VI. 30.) NGM rendelet
// 8. § (1) c) and 11/A. §, in the data structure of the decree's
// 2. melléklet (field glossary) and 3. melléklet (XSD).
//
// Schema: ./schema/23_2014_szamlasema.xsd — byte-for-byte the file NAV
// serves at TAX_AUDIT_XSD_SOURCE_URL (downloaded 2026-09-22, sha256
// f5a10d686e5d275fdca5d63df285e5ba5097fed7814f08611a1f813d99b7643d;
// namespace http://schemas.nav.gov.hu/2013/szamla; already contains the
// egyeni_vallalkozo / ev_nyilv_tart_szam / ev_neve elements added to the
// 2. melléklet by 21/2025. (VII. 7.) NGM rendelet). Do not edit it.
//
// Pure: no I/O. Refuses (returns `problems`) rather than emitting XML that
// would fail the XSD or silently invent mandatory data.
//
// Mapping decisions that need tax/legal sign-off before this ships (see
// the PR description):
//  - teljdatum = the persisted teljesítés dátuma (Invoice.fulfillmentDate),
//    falling back to the issue date only for legacy rows without one.
//  - Addresses are stored as one free-text street line, so the whole line
//    goes into <kozterulet_neve>; <kozterulet_jellege>/<hazszam> are not
//    split out. The schema's cim_tipus has no country element.
//  - adoertek/afaertekossz are in HUF (the XSD's own adoertek annotation);
//    every other amount stays in the invoice currency, named in <penznem>.
//  - Exempt / reverse-charge lines (AAM, TAM, KBAET, AHK, FAD, ATK) carry no
//    line <adokulcs>; their <afarovat> row uses adokulcs 0 (required there).
//  - Missing unit → "db", matching lib/nav/invoice-xml.ts.
//  - The EV-specific seller fields are not emitted: InvoHub's company
//    profile has no EV flag or nyilvántartási szám yet.
import { lineItemGrossTotal, lineItemNetTotal, lineItemVatAmount } from "@/lib/invoices/calculations";
import { resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import type { Company } from "@/lib/companies/service";
import type { Invoice, InvoiceLineItem, PaymentMethod, VatCategory } from "@/lib/invoices/types";
import { toNavDate } from "@/lib/nav/invoice-fields";
import { escapeXml } from "@/lib/nav/xml-utils";

export const TAX_AUDIT_XSD_SOURCE_URL =
  "https://nav.gov.hu/pfile/file?path=/ado/art/adozas_rendje/23-2014_szamlasema";
export const TAX_AUDIT_XML_NAMESPACE = "http://schemas.nav.gov.hu/2013/szamla";

export type TaxAuditExportInput = {
  /** Already selected (issued, in range) and ordered — see ./selection.ts. */
  invoices: Invoice[];
  company: Company | null;
  /** Invoice id → its invoice number, for storno/modify references outside the selection. */
  originalInvoiceNumbers: Record<string, string>;
  /** kezdo_ido / zaro_ido of the export header. */
  period: { from: string; to: string };
  /** export_datuma, YYYY-MM-DD. */
  exportDate: string;
};

export type TaxAuditProblemField =
  | "sellerTaxNumber"
  | "sellerName"
  | "sellerZipCode"
  | "sellerCity"
  | "sellerStreet"
  | "buyerName"
  | "buyerTaxNumber"
  | "buyerZipCode"
  | "buyerCity"
  | "buyerStreet"
  | "issueDate"
  | "exchangeRate"
  | "originalInvoiceNumber"
  | "lineItems";

export type TaxAuditProblem = { invoiceNumber: string; field: TaxAuditProblemField };

export type TaxAuditExportResult =
  | { ok: true; xml: string; invoiceCount: number }
  | { ok: false; problems: TaxAuditProblem[]; empty?: true };

// --- XSD simple-type helpers -------------------------------------------------

const STRING_MAX = 100; // string_tipus
const ZIP_MIN = 4; // cim_tipus/iranyitoszam
const ZIP_MAX = 10;
const TAX_NUMBER_MIN = 8; // adoszam_tipus
const TAX_NUMBER_MAX = 20;

function clean(value: string | undefined | null): string {
  return (value ?? "").trim();
}

/** string_tipus: 1..100 chars. Callers check non-emptiness first. */
function str(value: string): string {
  return escapeXml(Array.from(value).slice(0, STRING_MAX).join(""));
}

function isValidTaxNumber(value: string): boolean {
  return value.length >= TAX_NUMBER_MIN && value.length <= TAX_NUMBER_MAX;
}

function isValidZip(value: string): boolean {
  return value.length >= ZIP_MIN && value.length <= ZIP_MAX;
}

/** decimal_tipus: up to 2 fraction digits, "." separator; never "-0.00". */
function dec(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2);
}

function el(tag: string, content: string): string {
  return `<${tag}>${content}</${tag}>`;
}

function optionalEl(tag: string, content: string | null): string {
  return content ? el(tag, content) : "";
}

// --- mapping ----------------------------------------------------------------

const EXEMPT_CATEGORIES: ReadonlySet<VatCategory> = new Set(["AAM", "TAM", "KBAET", "AHK"]);

const PAYMENT_METHOD_HU: Record<PaymentMethod, string> = {
  transfer: "átutalás",
  cash: "készpénz",
  card: "bankkártya",
  other: "egyéb",
};

/** szlatipus_tipus: 1 számla, 3 módosító számla, 4 érvénytelenítő számla. */
function invoiceTypeCode(invoice: Invoice): "1" | "3" | "4" {
  if (invoice.documentType === "storno") return "4";
  if (invoice.documentType === "modify") return "3";
  return "1";
}

function referencedInvoiceId(invoice: Invoice): string | undefined {
  if (invoice.documentType === "storno") return invoice.originalInvoiceId;
  if (invoice.documentType === "modify") return invoice.modifiesInvoiceId;
  return undefined;
}

function addressXml(zip: string, city: string, street: string): string {
  return el(
    "cim",
    el("iranyitoszam", escapeXml(zip)) + el("telepules", str(city)) + el("kozterulet_neve", str(street))
  );
}

function sellerProblems(company: Company | null, invoiceNumber: string): TaxAuditProblem[] {
  const problems: TaxAuditProblem[] = [];
  const add = (field: TaxAuditProblemField) => problems.push({ invoiceNumber, field });
  if (!isValidTaxNumber(clean(company?.taxNumber))) add("sellerTaxNumber");
  if (!clean(company?.name)) add("sellerName");
  if (!isValidZip(clean(company?.zipCode))) add("sellerZipCode");
  if (!clean(company?.city)) add("sellerCity");
  if (!clean(company?.address)) add("sellerStreet");
  return problems;
}

function invoiceProblems(invoice: Invoice, originals: Record<string, string>): TaxAuditProblem[] {
  const problems: TaxAuditProblem[] = [];
  const add = (field: TaxAuditProblemField) =>
    problems.push({ invoiceNumber: invoice.invoiceNumber, field });

  if (!toNavDate(invoice.issueDate)) add("issueDate");
  if (!clean(invoice.clientName)) add("buyerName");
  const buyerTax = clean(invoice.clientTaxNumber);
  if (buyerTax && !isValidTaxNumber(buyerTax)) add("buyerTaxNumber");
  if (!isValidZip(clean(invoice.clientZipCode))) add("buyerZipCode");
  if (!clean(invoice.clientCity)) add("buyerCity");
  if (!clean(invoice.clientAddress)) add("buyerStreet");
  if (!resolveExchangeRate(invoice).ok) add("exchangeRate");
  const refId = referencedInvoiceId(invoice);
  if ((invoice.documentType === "storno" || invoice.documentType === "modify") && !(refId && originals[refId])) {
    add("originalInvoiceNumber");
  }
  if (invoice.lineItems.length === 0) add("lineItems");
  return problems;
}

type LineAmounts = { net: number; vat: number; gross: number; vatHuf: number };

function lineAmounts(line: InvoiceLineItem, rate: number): LineAmounts {
  const net = lineItemNetTotal(line);
  // lineItemVatAmount already forces 0% for every non-"normal" category.
  const vat = lineItemVatAmount(line);
  return { net, vat, gross: lineItemGrossTotal(line), vatHuf: toHufAmount(vat, rate) };
}

function lineXml(line: InvoiceLineItem, invoice: Invoice, rate: number): string {
  const amounts = lineAmounts(line, rate);
  const isNormal = line.vatCategory === "normal";
  const name = clean(line.description) || "Tétel";
  const unit = clean(line.unit) || "db";
  return el(
    "termek_szolgaltatas_tetelek",
    el("termeknev", str(name)) +
      (invoice.documentType === "advance" ? el("eloleg", "1") : "") +
      el("menny", dec(line.quantity)) +
      el("mertekegys", str(unit)) +
      el("nettoar", dec(amounts.net)) +
      el("nettoegysar", dec(line.unitPrice)) +
      (isNormal ? el("adokulcs", dec(line.vatRate)) : "") +
      el("adoertek", dec(amounts.vatHuf)) +
      el("bruttoar", dec(amounts.gross))
  );
}

function zaradekokXml(invoice: Invoice): string {
  const categories = new Set(invoice.lineItems.map((line) => line.vatCategory));
  const reverseCharge = categories.has("FAD");
  const exempt = Array.from(categories).some((category) => EXEMPT_CATEGORIES.has(category));
  if (!reverseCharge && !exempt) return "";
  // Sequence order per zaradekok_tipus: … onszamla, ford_ado, adoment_hiv …
  return el(
    "zaradekok",
    (reverseCharge ? el("ford_ado", "true") : "") + (exempt ? el("adoment_hiv", "true") : "")
  );
}

function nemKotelezoXml(invoice: Invoice, company: Company | null): string {
  const content =
    optionalEl("fiz_hatarido", toNavDate(invoice.dueDate)) +
    optionalEl("fiz_mod", invoice.paymentMethod ? PAYMENT_METHOD_HU[invoice.paymentMethod] : null) +
    el("penznem", str(invoice.currency)) +
    optionalEl("kibocsato_bankszla", clean(company?.bankAccount) ? str(clean(company?.bankAccount)) : null);
  return el("nem_kotelezo", content);
}

function osszesitesXml(invoice: Invoice, rate: number): string {
  const groups = new Map<string, { rate: number; net: number; vatHuf: number; gross: number }>();
  let net = 0;
  let vatHuf = 0;
  let gross = 0;
  for (const line of invoice.lineItems) {
    const amounts = lineAmounts(line, rate);
    const isNormal = line.vatCategory === "normal";
    const key = isNormal ? `pct:${line.vatRate}` : `cat:${line.vatCategory}`;
    const group = groups.get(key) ?? { rate: isNormal ? line.vatRate : 0, net: 0, vatHuf: 0, gross: 0 };
    group.net += amounts.net;
    group.vatHuf += amounts.vatHuf;
    group.gross += amounts.gross;
    groups.set(key, group);
    net += amounts.net;
    vatHuf += amounts.vatHuf;
    gross += amounts.gross;
  }

  const rows = Array.from(groups.values())
    .map((g) =>
      el("afarovat", el("nettoar", dec(g.net)) + el("adokulcs", dec(g.rate)) + el("adoertek", dec(g.vatHuf)) + el("bruttoar", dec(g.gross)))
    )
    .join("");

  return el(
    "osszesites",
    rows +
      el("vegosszeg", el("nettoarossz", dec(net)) + el("afaertekossz", dec(vatHuf)) + el("bruttoarossz", dec(gross)))
  );
}

function szamlaXml(invoice: Invoice, company: Company, originals: Record<string, string>): string {
  const rate = (resolveExchangeRate(invoice) as { ok: true; rate: number }).rate;
  const issueDate = toNavDate(invoice.issueDate) as string;

  const fejlec = el(
    "fejlec",
    el("szlasorszam", str(invoice.invoiceNumber)) +
      el("szlatipus", invoiceTypeCode(invoice)) +
      el("szladatum", issueDate) +
      el("teljdatum", toNavDate(invoice.fulfillmentDate ?? "") ?? issueDate)
  );

  const sellerEuVat = clean(company.euVatNumber);
  const seller = el(
    "szamlakibocsato",
    el("adoszam", escapeXml(clean(company.taxNumber))) +
      (isValidTaxNumber(sellerEuVat) ? el("kozadoszam", escapeXml(sellerEuVat)) : "") +
      el("nev", str(clean(company.name))) +
      addressXml(clean(company.zipCode), clean(company.city), clean(company.address))
  );

  const buyerTax = clean(invoice.clientTaxNumber);
  const buyerEuVat = clean(invoice.clientEuVatNumber);
  const buyer = el(
    "vevo",
    (buyerTax ? el("adoszam", escapeXml(buyerTax)) : "") +
      (isValidTaxNumber(buyerEuVat) ? el("kozadoszam", escapeXml(buyerEuVat)) : "") +
      el("nev", str(clean(invoice.clientName))) +
      addressXml(clean(invoice.clientZipCode), clean(invoice.clientCity), clean(invoice.clientAddress))
  );

  const lines = invoice.lineItems.map((line) => lineXml(line, invoice, rate)).join("");
  const refId = referencedInvoiceId(invoice);
  const modosito = refId ? el("modosito_szla", el("eredeti_sorszam", str(originals[refId]))) : "";

  return el(
    "szamla",
    fejlec + seller + buyer + lines + modosito + zaradekokXml(invoice) + nemKotelezoXml(invoice, company) + osszesitesXml(invoice, rate)
  );
}

export function buildTaxAuditExportXml(input: TaxAuditExportInput): TaxAuditExportResult {
  const { invoices, company, originalInvoiceNumbers, period, exportDate } = input;
  if (invoices.length === 0) return { ok: false, problems: [], empty: true };

  const problems = [
    ...sellerProblems(company, invoices[0].invoiceNumber),
    ...invoices.flatMap((invoice) => invoiceProblems(invoice, originalInvoiceNumbers)),
  ];
  if (problems.length > 0 || !company) return { ok: false, problems };

  const header =
    el("export_datuma", exportDate) +
    el("export_szla_db", String(invoices.length)) +
    el("kezdo_ido", period.from) +
    el("zaro_ido", period.to) +
    el("kezdo_szla_szam", str(invoices[0].invoiceNumber)) +
    el("zaro_szla_szam", str(invoices[invoices.length - 1].invoiceNumber));

  const body = invoices.map((invoice) => szamlaXml(invoice, company, originalInvoiceNumbers)).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<szamlak xmlns="${TAX_AUDIT_XML_NAMESPACE}">\n${header}\n${body}\n</szamlak>\n`;
  return { ok: true, xml, invoiceCount: invoices.length };
}
