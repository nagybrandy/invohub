// lib/invoices/tax-audit-export/generate.test.ts
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { getCompanyByUserId } from "@/lib/companies/service";
import { getInvoiceById, listInvoicesInDateRange } from "@/lib/invoices/service";
import {
  generateTaxAuditExport,
  TAX_AUDIT_MAX_INVOICES,
} from "@/lib/invoices/tax-audit-export/generate";

jest.mock("@/lib/invoices/service", () => ({
  listInvoicesInDateRange: jest.fn(),
  getInvoiceById: jest.fn(),
}));
jest.mock("@/lib/companies/service", () => ({ getCompanyByUserId: jest.fn() }));

const mockList = listInvoicesInDateRange as jest.MockedFunction<typeof listInvoicesInDateRange>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;

const company = {
  id: "co-1",
  userId: "user-1",
  name: "Minta Béla e.v.",
  taxNumber: "12345678-1-42",
  address: "Fő utca 1.",
  city: "Budapest",
  zipCode: "1011",
  createdAt: "",
  updatedAt: "",
};

const address = {
  clientZipCode: "6720",
  clientCity: "Szeged",
  clientAddress: "Kárász utca 5.",
};

const now = new Date("2026-09-22T10:00:00Z");

describe("generateTaxAuditExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany.mockResolvedValue(company);
  });

  it("date range: loads the caller's invoices for exactly that range and drops drafts/proformas", async () => {
    mockList.mockResolvedValue([
      makeInvoice({ id: "a", invoiceNumber: "INV-2026-00001", issueDate: "2026-02-01", ...address }),
      makeInvoice({ id: "d", invoiceNumber: "", status: "draft", issueDate: "2026-02-02", ...address }),
      makeInvoice({ id: "p", invoiceNumber: "DBK-2026-00001", documentType: "proforma", status: "proforma", ...address }),
    ]);

    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "date", from: "2026-01-01", to: "2026-03-31" },
      now
    );

    expect(mockList).toHaveBeenCalledWith("user-1", "2026-01-01", "2026-03-31");
    expect(mockCompany).toHaveBeenCalledWith("user-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoiceCount).toBe(1);
    expect(result.xml).toContain("<export_datuma>2026-09-22</export_datuma>");
    expect(result.xml).toContain("<kezdo_ido>2026-01-01</kezdo_ido>");
    expect(result.xml).not.toContain("DBK-2026-00001");
    expect(result.filename).toBe("adohatosagi-ellenorzesi-adatszolgaltatas_2026-01-01_2026-03-31.xml");
  });

  it("number range: loads the numbers' years and derives the period from the selected invoices", async () => {
    mockList.mockResolvedValue([
      makeInvoice({ id: "a", invoiceNumber: "INV-2026-00001", issueDate: "2026-01-10", ...address }),
      makeInvoice({ id: "b", invoiceNumber: "INV-2026-00002", issueDate: "2026-02-10", ...address }),
      makeInvoice({ id: "c", invoiceNumber: "INV-2026-00003", issueDate: "2026-03-10", ...address }),
    ]);

    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "number", fromNumber: "INV-2026-00002", toNumber: "INV-2026-00003" },
      now
    );

    expect(mockList).toHaveBeenCalledWith("user-1", "2026-01-01", "2026-12-31");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoiceCount).toBe(2);
    expect(result.xml).toContain("<kezdo_ido>2026-02-10</kezdo_ido>");
    expect(result.xml).toContain("<zaro_ido>2026-03-10</zaro_ido>");
    expect(result.filename).toBe(
      "adohatosagi-ellenorzesi-adatszolgaltatas_INV-2026-00002_INV-2026-00003.xml"
    );
  });

  it("resolves a storno's original invoice number even when the original is outside the range", async () => {
    mockList.mockResolvedValue([
      makeInvoice({
        id: "st",
        invoiceNumber: "INV-2026-00009",
        documentType: "storno",
        originalInvoiceId: "orig",
        issueDate: "2026-02-01",
        ...address,
      }),
    ]);
    mockGet.mockResolvedValue(makeInvoice({ id: "orig", invoiceNumber: "INV-2025-00120" }));

    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "date", from: "2026-02-01", to: "2026-02-28" },
      now
    );

    expect(mockGet).toHaveBeenCalledWith("user-1", "orig");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.xml).toContain("<eredeti_sorszam>INV-2025-00120</eredeti_sorszam>");
  });

  it("does not re-fetch an original that is already in the loaded range", async () => {
    mockList.mockResolvedValue([
      makeInvoice({ id: "orig", invoiceNumber: "INV-2026-00001", status: "cancelled", issueDate: "2026-02-01", ...address }),
      makeInvoice({ id: "st", invoiceNumber: "INV-2026-00002", documentType: "storno", originalInvoiceId: "orig", issueDate: "2026-02-02", ...address }),
    ]);
    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "date", from: "2026-02-01", to: "2026-02-28" },
      now
    );
    expect(mockGet).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("reports an empty selection", async () => {
    mockList.mockResolvedValue([]);
    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "date", from: "2026-01-01", to: "2026-01-31" },
      now
    );
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("passes data problems through instead of producing an invalid file", async () => {
    mockList.mockResolvedValue([
      makeInvoice({ invoiceNumber: "INV-2026-00001", issueDate: "2026-01-02", clientZipCode: undefined, clientCity: "Szeged", clientAddress: "Fő tér 1." }),
    ]);
    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "date", from: "2026-01-01", to: "2026-01-31" },
      now
    );
    expect(result).toEqual({
      ok: false,
      reason: "problems",
      problems: [{ invoiceNumber: "INV-2026-00001", field: "buyerZipCode" }],
    });
  });

  it("refuses a selection above the per-file limit rather than building an unbounded file", async () => {
    mockList.mockResolvedValue(
      Array.from({ length: TAX_AUDIT_MAX_INVOICES + 1 }, (_, i) =>
        makeInvoice({ id: `i${i}`, invoiceNumber: `INV-2026-${String(i + 1).padStart(5, "0")}`, issueDate: "2026-01-02", ...address })
      )
    );
    const result = await generateTaxAuditExport(
      "user-1",
      { kind: "date", from: "2026-01-01", to: "2026-12-31" },
      now
    );
    expect(result).toEqual({ ok: false, reason: "tooMany", limit: TAX_AUDIT_MAX_INVOICES });
  });
});
