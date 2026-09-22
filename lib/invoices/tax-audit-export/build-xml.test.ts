// lib/invoices/tax-audit-export/build-xml.test.ts
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import type { Company } from "@/lib/companies/service";
import type { Invoice } from "@/lib/invoices/types";
import {
  buildTaxAuditExportXml,
  TAX_AUDIT_XSD_SOURCE_URL,
  type TaxAuditExportInput,
} from "@/lib/invoices/tax-audit-export/build-xml";
import { extractAllTags, extractBlock, extractTag } from "@/lib/nav/xml-utils";

const TAX_AUDIT_XSD_PATH = path.join(__dirname, "schema", "23_2014_szamlasema.xsd");

const company: Company = {
  id: "co-1",
  userId: "user-1",
  name: "Minta Béla e.v.",
  taxNumber: "12345678-1-42",
  euVatNumber: "HU12345678",
  address: "Fő utca 1.",
  city: "Budapest",
  zipCode: "1011",
  country: "HU",
  bankAccount: "11111111-22222222-33333333",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buyer(overrides: Partial<Invoice> = {}): Partial<Invoice> {
  return {
    clientName: "Acme Kft.",
    clientTaxNumber: "87654321-2-13",
    clientZipCode: "6720",
    clientCity: "Szeged",
    clientAddress: "Kárász utca 5.",
    clientCountry: "HU",
    ...overrides,
  };
}

function input(invoices: Invoice[], overrides: Partial<TaxAuditExportInput> = {}): TaxAuditExportInput {
  return {
    invoices,
    company,
    originalInvoiceNumbers: {},
    period: { from: "2026-01-01", to: "2026-12-31" },
    exportDate: "2026-09-22",
    ...overrides,
  };
}

function buildOk(data: TaxAuditExportInput): string {
  const result = buildTaxAuditExportXml(data);
  if (!result.ok) throw new Error(`expected ok, got problems ${JSON.stringify(result.problems)}`);
  return result.xml;
}

const normal = makeInvoice({
  id: "inv-1",
  invoiceNumber: "INV-2026-00001",
  issueDate: "2026-03-02",
  dueDate: "2026-03-10",
  paymentMethod: "transfer",
  ...buyer(),
  lineItems: [
    makeLineItem({ id: "l1", description: "Tanácsadás", quantity: 2, unitPrice: 10000, vatRate: 27, unit: "óra" }),
    makeLineItem({ id: "l2", description: "Kiszállás", quantity: 1, unitPrice: 5000, vatRate: 5 }),
  ],
});

describe("buildTaxAuditExportXml — document shell (23/2014. NGM rendelet 2–3. melléklet)", () => {
  it("emits a UTF-8 <szamlak> root in the NAV 2013/szamla namespace with the export header", () => {
    const xml = buildOk(input([normal]));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<szamlak xmlns="http://schemas.nav.gov.hu/2013/szamla">');
    expect(extractTag(xml, "export_datuma")).toBe("2026-09-22");
    expect(extractTag(xml, "export_szla_db")).toBe("1");
    expect(extractTag(xml, "kezdo_ido")).toBe("2026-01-01");
    expect(extractTag(xml, "zaro_ido")).toBe("2026-12-31");
    expect(extractTag(xml, "kezdo_szla_szam")).toBe("INV-2026-00001");
    expect(extractTag(xml, "zaro_szla_szam")).toBe("INV-2026-00001");
  });

  it("uses the first and last exported invoice numbers for the number-range header", () => {
    const second = makeInvoice({ ...normal, id: "inv-2", invoiceNumber: "INV-2026-00002" });
    const xml = buildOk(input([normal, second]));
    expect(extractTag(xml, "export_szla_db")).toBe("2");
    expect(extractTag(xml, "kezdo_szla_szam")).toBe("INV-2026-00001");
    expect(extractTag(xml, "zaro_szla_szam")).toBe("INV-2026-00002");
    expect(extractAllTags(xml, "szlasorszam")).toEqual(["INV-2026-00001", "INV-2026-00002"]);
  });

  it("refuses an empty selection (the XSD requires at least one <szamla>)", () => {
    expect(buildTaxAuditExportXml(input([]))).toEqual({ ok: false, problems: [], empty: true });
  });
});

describe("buildTaxAuditExportXml — header, seller, buyer", () => {
  it("maps fejlec: number, type 1, issue date, fulfilment date", () => {
    const xml = buildOk(input([normal]));
    const fejlec = extractBlock(xml, "fejlec")!;
    expect(extractTag(fejlec, "szlatipus")).toBe("1");
    expect(extractTag(fejlec, "szladatum")).toBe("2026-03-02");
    expect(extractTag(fejlec, "teljdatum")).toBe("2026-03-02");
  });

  it("maps the seller (szamlakibocsato) incl. address", () => {
    const xml = buildOk(input([normal]));
    const seller = extractBlock(xml, "szamlakibocsato")!;
    expect(extractTag(seller, "adoszam")).toBe("12345678-1-42");
    expect(extractTag(seller, "kozadoszam")).toBe("HU12345678");
    expect(extractTag(seller, "nev")).toBe("Minta Béla e.v.");
    expect(extractTag(seller, "iranyitoszam")).toBe("1011");
    expect(extractTag(seller, "telepules")).toBe("Budapest");
    expect(extractTag(seller, "kozterulet_neve")).toBe("Fő utca 1.");
  });

  it("maps the buyer (vevo) from the invoice's address snapshot, not the live client", () => {
    const xml = buildOk(
      input([makeInvoice({ ...normal, ...buyer({ clientEuVatNumber: "HU87654321" }) })])
    );
    const vevo = extractBlock(xml, "vevo")!;
    expect(extractTag(vevo, "adoszam")).toBe("87654321-2-13");
    expect(extractTag(vevo, "kozadoszam")).toBe("HU87654321");
    expect(extractTag(vevo, "nev")).toBe("Acme Kft.");
    expect(extractTag(vevo, "iranyitoszam")).toBe("6720");
    expect(extractTag(vevo, "telepules")).toBe("Szeged");
    expect(extractTag(vevo, "kozterulet_neve")).toBe("Kárász utca 5.");
  });

  it("omits the buyer tax number for a private-person buyer", () => {
    const xml = buildOk(input([makeInvoice({ ...normal, clientTaxNumber: undefined })]));
    expect(extractTag(extractBlock(xml, "vevo")!, "adoszam")).toBeNull();
  });

  it("escapes XML special characters in free text", () => {
    const xml = buildOk(input([makeInvoice({ ...normal, clientName: "Kovács & <Fia> Bt." })]));
    expect(xml).toContain("<nev>Kovács &amp; &lt;Fia&gt; Bt.</nev>");
  });
});

describe("buildTaxAuditExportXml — line items and VAT", () => {
  it("maps a taxed line: quantity, unit, net, unit price, rate, VAT, gross", () => {
    const xml = buildOk(input([normal]));
    const [first, second] = xml.match(/<termek_szolgaltatas_tetelek>[\s\S]*?<\/termek_szolgaltatas_tetelek>/g)!;
    expect(extractTag(first, "termeknev")).toBe("Tanácsadás");
    expect(extractTag(first, "menny")).toBe("2.00");
    expect(extractTag(first, "mertekegys")).toBe("óra");
    expect(extractTag(first, "nettoar")).toBe("20000.00");
    expect(extractTag(first, "nettoegysar")).toBe("10000.00");
    expect(extractTag(first, "adokulcs")).toBe("27.00");
    expect(extractTag(first, "adoertek")).toBe("5400.00");
    expect(extractTag(first, "bruttoar")).toBe("25400.00");
    // No unit recorded on the line → the same "db" default the NAV XML uses.
    expect(extractTag(second, "mertekegys")).toBe("db");
  });

  it("summarises by VAT rate and totals (osszesites)", () => {
    const xml = buildOk(input([normal]));
    const rows = xml.match(/<afarovat>[\s\S]*?<\/afarovat>/g)!;
    expect(rows).toHaveLength(2);
    expect(extractTag(rows[0], "adokulcs")).toBe("27.00");
    expect(extractTag(rows[0], "nettoar")).toBe("20000.00");
    expect(extractTag(rows[1], "adokulcs")).toBe("5.00");
    expect(extractTag(rows[1], "adoertek")).toBe("250.00");
    const vegosszeg = extractBlock(xml, "vegosszeg")!;
    expect(extractTag(vegosszeg, "nettoarossz")).toBe("25000.00");
    expect(extractTag(vegosszeg, "afaertekossz")).toBe("5650.00");
    expect(extractTag(vegosszeg, "bruttoarossz")).toBe("30650.00");
  });

  it("AAM (alanyi adómentes): no rate on the line, zero VAT, adómentességi záradék", () => {
    const xml = buildOk(
      input([
        makeInvoice({
          ...normal,
          lineItems: [makeLineItem({ id: "x", vatCategory: "AAM", vatRate: 0, quantity: 1, unitPrice: 8000 })],
        }),
      ])
    );
    const line = extractBlock(xml, "termek_szolgaltatas_tetelek")!;
    expect(extractTag(line, "adokulcs")).toBeNull();
    expect(extractTag(line, "adoertek")).toBe("0.00");
    expect(extractTag(line, "bruttoar")).toBe("8000.00");
    const zaradekok = extractBlock(xml, "zaradekok")!;
    expect(extractTag(zaradekok, "adoment_hiv")).toBe("true");
    expect(extractTag(zaradekok, "ford_ado")).toBeNull();
  });

  it("TAM is also flagged as adómentes", () => {
    const xml = buildOk(
      input([makeInvoice({ ...normal, lineItems: [makeLineItem({ vatCategory: "TAM", vatRate: 0 })] })])
    );
    expect(extractTag(extractBlock(xml, "zaradekok")!, "adoment_hiv")).toBe("true");
  });

  it("FAD (fordított adózás): zero VAT on the line and the ford_ado záradék", () => {
    const xml = buildOk(
      input([makeInvoice({ ...normal, lineItems: [makeLineItem({ vatCategory: "FAD", vatRate: 27 })] })])
    );
    const line = extractBlock(xml, "termek_szolgaltatas_tetelek")!;
    expect(extractTag(line, "adoertek")).toBe("0.00");
    expect(extractTag(extractBlock(xml, "zaradekok")!, "ford_ado")).toBe("true");
  });

  it("omits <zaradekok> entirely for a plain taxed invoice", () => {
    expect(buildOk(input([normal]))).not.toContain("<zaradekok>");
  });

  it("marks advance-invoice lines with eloleg=1", () => {
    const xml = buildOk(
      input([makeInvoice({ ...normal, documentType: "advance", invoiceNumber: "ELO-2026-00001" })])
    );
    expect(extractAllTags(xml, "eloleg")).toEqual(["1", "1"]);
    expect(extractTag(xml, "szlatipus")).toBe("1");
  });

  it("truncates product names to the XSD's 100-character limit", () => {
    const long = "A".repeat(150);
    const xml = buildOk(input([makeInvoice({ ...normal, lineItems: [makeLineItem({ description: long })] })]));
    expect(extractTag(xml, "termeknev")).toBe("A".repeat(100));
  });
});

describe("buildTaxAuditExportXml — storno / helyesbítő", () => {
  it("storno: szlatipus 4 (érvénytelenítő) with the original invoice number", () => {
    const storno = makeInvoice({
      ...normal,
      id: "st-1",
      invoiceNumber: "INV-2026-00005",
      documentType: "storno",
      originalInvoiceId: "inv-1",
      lineItems: [makeLineItem({ quantity: -2, unitPrice: 10000 })],
    });
    const xml = buildOk(input([storno], { originalInvoiceNumbers: { "inv-1": "INV-2026-00001" } }));
    expect(extractTag(xml, "szlatipus")).toBe("4");
    expect(extractTag(extractBlock(xml, "modosito_szla")!, "eredeti_sorszam")).toBe("INV-2026-00001");
    expect(extractTag(xml, "nettoar")).toBe("-20000.00");
  });

  it("modify: szlatipus 3 (módosító) with the modified invoice number", () => {
    const modify = makeInvoice({
      ...normal,
      id: "mod-1",
      invoiceNumber: "INV-2026-00006",
      documentType: "modify",
      modifiesInvoiceId: "inv-1",
    });
    const xml = buildOk(input([modify], { originalInvoiceNumbers: { "inv-1": "INV-2026-00001" } }));
    expect(extractTag(xml, "szlatipus")).toBe("3");
    expect(extractTag(xml, "eredeti_sorszam")).toBe("INV-2026-00001");
  });
});

describe("buildTaxAuditExportXml — non-HUF invoices", () => {
  it("keeps amounts in the invoice currency, states the currency, and gives VAT in HUF", () => {
    const eur = makeInvoice({
      ...normal,
      currency: "EUR",
      exchangeRate: 400,
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 })],
    });
    const xml = buildOk(input([eur]));
    const line = extractBlock(xml, "termek_szolgaltatas_tetelek")!;
    expect(extractTag(line, "nettoar")).toBe("100.00");
    // XSD adoertek doc: "Forintban kifejezve abban az esetben is fel kell tüntetni, ha az egyéb adatok külföldi pénznemben kifejezettek."
    expect(extractTag(line, "adoertek")).toBe("10800.00");
    expect(extractTag(extractBlock(xml, "nem_kotelezo")!, "penznem")).toBe("EUR");
  });
});

describe("buildTaxAuditExportXml — nem_kotelezo", () => {
  it("emits due date, payment method, currency and the seller bank account", () => {
    const block = extractBlock(buildOk(input([normal])), "nem_kotelezo")!;
    expect(extractTag(block, "fiz_hatarido")).toBe("2026-03-10");
    expect(extractTag(block, "fiz_mod")).toBe("átutalás");
    expect(extractTag(block, "penznem")).toBe("HUF");
    expect(extractTag(block, "kibocsato_bankszla")).toBe("11111111-22222222-33333333");
  });
});

describe("buildTaxAuditExportXml — refuses to emit invalid data", () => {
  it("reports every invoice missing mandatory buyer address parts instead of guessing", () => {
    const result = buildTaxAuditExportXml(
      input([makeInvoice({ ...normal, clientZipCode: undefined, clientAddress: " " })])
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        { invoiceNumber: "INV-2026-00001", field: "buyerZipCode" },
        { invoiceNumber: "INV-2026-00001", field: "buyerStreet" },
      ],
    });
  });

  it("reports a missing seller tax number / address once, against the first invoice", () => {
    const result = buildTaxAuditExportXml(
      input([normal], { company: { ...company, taxNumber: undefined, city: undefined } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.field)).toEqual(["sellerTaxNumber", "sellerCity"]);
  });

  it("reports a non-HUF invoice without an exchange rate", () => {
    const result = buildTaxAuditExportXml(
      input([makeInvoice({ ...normal, currency: "EUR", exchangeRate: undefined })])
    );
    expect(result).toEqual({
      ok: false,
      problems: [{ invoiceNumber: "INV-2026-00001", field: "exchangeRate" }],
    });
  });

  it("reports a storno whose original invoice number can't be resolved", () => {
    const result = buildTaxAuditExportXml(
      input([makeInvoice({ ...normal, documentType: "storno", originalInvoiceId: "gone" })])
    );
    expect(result).toEqual({
      ok: false,
      problems: [{ invoiceNumber: "INV-2026-00001", field: "originalInvoiceNumber" }],
    });
  });
});

// Full validation against the official schema file (NAV, 23_2014_szamlasema.xsd)
// when libxml2's xmllint is on the machine (macOS ships it; most Linux CI
// images have it via libxml2-utils). No XSD validator exists in node_modules,
// so this is skipped — not faked — where xmllint is absent; the structural
// assertions above still run everywhere.
function hasXmllint(): boolean {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const describeWithXmllint = hasXmllint() ? describe : describe.skip;

describe("official schema file", () => {
  it("is the unmodified NAV download for the 2013/szamla namespace, incl. the EV fields", () => {
    expect(TAX_AUDIT_XSD_SOURCE_URL).toBe(
      "https://nav.gov.hu/pfile/file?path=/ado/art/adozas_rendje/23-2014_szamlasema"
    );
    const xsd = fs.readFileSync(TAX_AUDIT_XSD_PATH, "utf8");
    expect(xsd).toContain('targetNamespace="http://schemas.nav.gov.hu/2013/szamla"');
    expect(xsd).toContain('name="egyeni_vallalkozo"');
  });
});

describeWithXmllint("buildTaxAuditExportXml — validates against the official XSD (xmllint)", () => {
  function validate(xml: string): void {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tax-audit-"));
    const file = path.join(dir, "export.xml");
    fs.writeFileSync(file, xml, "utf8");
    try {
      execFileSync("xmllint", ["--noout", "--schema", TAX_AUDIT_XSD_PATH, file], { stdio: "pipe" });
    } catch (error) {
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? String(error);
      throw new Error(`XSD validation failed:\n${stderr}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it("a mixed export (taxed, AAM, FAD, advance, storno, modify, EUR) is schema-valid", () => {
    const invoices: Invoice[] = [
      normal,
      makeInvoice({
        ...normal,
        id: "aam",
        invoiceNumber: "INV-2026-00002",
        clientTaxNumber: undefined,
        lineItems: [makeLineItem({ vatCategory: "AAM", vatRate: 0 })],
      }),
      makeInvoice({
        ...normal,
        id: "fad",
        invoiceNumber: "INV-2026-00003",
        lineItems: [makeLineItem({ vatCategory: "FAD", vatRate: 27 })],
      }),
      makeInvoice({ ...normal, id: "adv", invoiceNumber: "ELO-2026-00001", documentType: "advance" }),
      makeInvoice({
        ...normal,
        id: "st",
        invoiceNumber: "INV-2026-00004",
        documentType: "storno",
        originalInvoiceId: "inv-1",
        lineItems: [makeLineItem({ quantity: -2 })],
      }),
      makeInvoice({
        ...normal,
        id: "mod",
        invoiceNumber: "INV-2026-00005",
        documentType: "modify",
        modifiesInvoiceId: "inv-1",
        paymentMethod: undefined,
      }),
      makeInvoice({
        ...normal,
        id: "eur",
        invoiceNumber: "INV-2026-00006",
        currency: "EUR",
        exchangeRate: 395.12,
        ...buyer({ clientCountry: "AT", clientZipCode: "1010", clientCity: "Wien", clientEuVatNumber: "ATU12345678", clientTaxNumber: undefined }),
      }),
    ];
    validate(buildOk(input(invoices, { originalInvoiceNumbers: { "inv-1": "INV-2026-00001" } })));
  });

  it("a seller without an EU VAT number or bank account is still schema-valid", () => {
    validate(
      buildOk(input([normal], { company: { ...company, euVatNumber: undefined, bankAccount: undefined } }))
    );
  });
});
