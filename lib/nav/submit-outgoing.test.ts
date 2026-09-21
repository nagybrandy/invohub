// lib/nav/submit-outgoing.test.ts
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("@/db", () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

const mockGetCompanyByUserId = jest.fn();
jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: (...args: unknown[]) => mockGetCompanyByUserId(...args),
}));

const mockGetInvoiceById = jest.fn();
jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: (...args: unknown[]) => mockGetInvoiceById(...args),
}));

const mockHasSuccessfulNavSubmission = jest.fn();
jest.mock("@/lib/nav/submission-history", () => ({
  hasSuccessfulNavSubmission: (...args: unknown[]) => mockHasSuccessfulNavSubmission(...args),
}));

const mockTokenExchange = jest.fn();
const mockManageInvoice = jest.fn();
const mockGetNavClient = jest.fn(() => ({
  environment: "demo",
  tokenExchange: mockTokenExchange,
  manageInvoice: mockManageInvoice,
  queryTransactionStatus: jest.fn(),
  queryTaxpayer: jest.fn(),
}));
jest.mock("@/lib/nav/client", () => ({
  getNavClient: (...args: unknown[]) => mockGetNavClient(...args),
}));

const mockResolveNavCredentials = jest.fn();
jest.mock("@/lib/nav/resolve-credentials", () => ({
  resolveNavCredentials: (...args: unknown[]) => mockResolveNavCredentials(...args),
}));

describe("submitOutgoingInvoiceToNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenExchange.mockResolvedValue({ exchangeToken: "tok-abc" });
    mockManageInvoice.mockResolvedValue({ transactionId: "NAV-TXN-TEST" });
    mockHasSuccessfulNavSubmission.mockResolvedValue(false);
  });

  it("defaults to demo mode and never resolves real credentials", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    const invoice = makeInvoice();

    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockGetNavClient).toHaveBeenCalledWith("demo");
    expect(mockResolveNavCredentials).not.toHaveBeenCalled();
    expect(mockTokenExchange).toHaveBeenCalledWith(null);
    expect(mockManageInvoice).toHaveBeenCalledWith(
      null,
      "tok-abc",
      expect.arrayContaining([expect.objectContaining({ index: 1, operation: "CREATE" })])
    );
    expect(result.status).toBe("sent");
    expect(result.mode).toBe("demo");
    expect(result.transactionId).toBe("NAV-TXN-TEST");
    expect(result.invoiceXml).toContain("<invoiceNumber>");
    expect(result.submissionId).toBeTruthy();
  });

  it("resolves real credentials and uses the test client for mode=test", async () => {
    mockGetCompanyByUserId.mockResolvedValue({
      name: "Demo Kft.",
      taxNumber: "12345678-1-23",
      navEnvironment: "test",
    });
    const fakeCredentials = { login: "l", password: "p", signKey: "s", exchangeKey: "e", taxNumber: "12345678", environment: "test", source: "own" };
    mockResolveNavCredentials.mockReturnValue(fakeCredentials);

    const invoice = makeInvoice();
    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockGetNavClient).toHaveBeenCalledWith("test");
    expect(mockResolveNavCredentials).toHaveBeenCalled();
    expect(mockTokenExchange).toHaveBeenCalledWith(fakeCredentials);
    expect(result.mode).toBe("test");
  });

  it("submits documentType=storno invoices with the STORNO operation and an <invoiceReference> block", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-original", invoiceNumber: "INV-2026-042" }));
    mockHasSuccessfulNavSubmission.mockResolvedValue(true);
    const invoice = makeInvoice({ documentType: "storno", originalInvoiceId: "inv-original" });

    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockGetInvoiceById).toHaveBeenCalledWith("user-1", "inv-original");
    expect(mockHasSuccessfulNavSubmission).toHaveBeenCalledWith("inv-original");
    expect(mockManageInvoice).toHaveBeenCalledWith(
      null,
      "tok-abc",
      expect.arrayContaining([expect.objectContaining({ index: 1, operation: "STORNO" })])
    );
    expect(result.invoiceXml).toContain("<invoiceReference>");
    expect(result.invoiceXml).toContain("<originalInvoiceNumber>INV-2026-042</originalInvoiceNumber>");
    // The original WAS successfully exchanged with NAV (mocked true above).
    expect(result.invoiceXml).toContain("<modifyWithoutMaster>false</modifyWithoutMaster>");
  });

  it("submits documentType=modify invoices with the MODIFY operation and modificationIndex", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-original", invoiceNumber: "INV-2026-050" }));
    const invoice = makeInvoice({
      documentType: "modify",
      modifiesInvoiceId: "inv-original",
      modificationIndex: 2,
    });

    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockManageInvoice).toHaveBeenCalledWith(
      null,
      "tok-abc",
      expect.arrayContaining([expect.objectContaining({ index: 1, operation: "MODIFY" })])
    );
    expect(result.invoiceXml).toContain("<originalInvoiceNumber>INV-2026-050</originalInvoiceNumber>");
    expect(result.invoiceXml).toContain("<modificationIndex>2</modificationIndex>");
  });

  it("sets modifyWithoutMaster=true when the original was never successfully exchanged with NAV", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-original", invoiceNumber: "INV-2026-060" }));
    mockHasSuccessfulNavSubmission.mockResolvedValue(false);
    const invoice = makeInvoice({ documentType: "storno", originalInvoiceId: "inv-original" });

    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(result.invoiceXml).toContain("<modifyWithoutMaster>true</modifyWithoutMaster>");
  });

  it("rejects a storno submission missing its originalInvoiceId", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    const invoice = makeInvoice({ documentType: "storno", originalInvoiceId: undefined });

    await expect(submitOutgoingInvoiceToNav("user-1", invoice)).rejects.toThrow(
      /missing its reference/
    );
    expect(mockManageInvoice).not.toHaveBeenCalled();
  });

  it("rejects a storno submission whose referenced original invoice can't be found", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    mockGetInvoiceById.mockResolvedValue(null);
    const invoice = makeInvoice({ documentType: "storno", originalInvoiceId: "inv-missing" });

    await expect(submitOutgoingInvoiceToNav("user-1", invoice)).rejects.toThrow(/was not found/);
    expect(mockManageInvoice).not.toHaveBeenCalled();
  });

  it("does not look up a reference or emit <invoiceReference> for a plain CREATE", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    const invoice = makeInvoice({ documentType: "invoice" });

    const result = await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockGetInvoiceById).not.toHaveBeenCalled();
    expect(result.invoiceXml).not.toContain("<invoiceReference>");
  });

  it("rejects a non-HUF invoice with no exchange rate — no navSubmission row inserted, manageInvoice never called (AC9)", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    const invoice = makeInvoice({ currency: "EUR", exchangeRate: undefined });
    const { db } = require("@/db") as { db: { insert: jest.Mock } };

    await expect(submitOutgoingInvoiceToNav("user-1", invoice)).rejects.toThrow(
      /exchange rate/i
    );

    expect(mockManageInvoice).not.toHaveBeenCalled();
    expect(mockTokenExchange).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  // AC1: a submission records what it actually reported to NAV.
  describe("records what it reported (AC1)", () => {
    function insertedValues(): Record<string, unknown> {
      const { db } = require("@/db") as { db: { insert: jest.Mock } };
      const valuesMock = db.insert.mock.results[0].value.values as jest.Mock;
      return valuesMock.mock.calls[0][0];
    }

    it("1.2 — records reportedCurrency + reportedExchangeRate (formatExchangeRate form) for a non-HUF invoice", async () => {
      mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
      const invoice = makeInvoice({
        currency: "EUR",
        exchangeRate: 398.5,
        lineItems: [{ id: "l1", description: "Consulting", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" }],
      });

      await submitOutgoingInvoiceToNav("user-1", invoice);

      const values = insertedValues();
      expect(values.reportedCurrency).toBe("EUR");
      expect(values.reportedExchangeRate).toBe("398.5");
    });

    it("1.3 — records reportedExchangeRate \"1\" for a HUF invoice", async () => {
      mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
      const invoice = makeInvoice({ currency: "HUF" });

      await submitOutgoingInvoiceToNav("user-1", invoice);

      const values = insertedValues();
      expect(values.reportedCurrency).toBe("HUF");
      expect(values.reportedExchangeRate).toBe("1");
    });

    it("1.4 — reportedVatHuf equals the summed per-line HUF VAT (converted per line, then summed)", async () => {
      mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
      const invoice = makeInvoice({
        currency: "EUR",
        exchangeRate: 400,
        lineItems: [
          { id: "l1", description: "A", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" },
          { id: "l2", description: "B", quantity: 1, unitPrice: 50, vatRate: 27, vatCategory: "normal" },
        ],
      });

      await submitOutgoingInvoiceToNav("user-1", invoice);

      const values = insertedValues();
      // per line: 27 EUR VAT * 400 = 10800; 13.5 EUR VAT * 400 = 5400 -> 16200
      expect(values.reportedVatHuf).toBe("16200.00");
    });

    it("1.4b — exempt (AAM) lines report zero HUF VAT", async () => {
      mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
      const invoice = makeInvoice({
        currency: "EUR",
        exchangeRate: 400,
        lineItems: [{ id: "l1", description: "A", quantity: 1, unitPrice: 100, vatRate: 0, vatCategory: "AAM" }],
      });

      await submitOutgoingInvoiceToNav("user-1", invoice);

      expect(insertedValues().reportedVatHuf).toBe("0.00");
    });

    it("1.5 — tokenExchange/manageInvoice are each still called exactly once with identical args, result shape unchanged", async () => {
      mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
      const invoice = makeInvoice({ currency: "EUR", exchangeRate: 398.5 });

      const result = await submitOutgoingInvoiceToNav("user-1", invoice);

      expect(mockTokenExchange).toHaveBeenCalledTimes(1);
      expect(mockTokenExchange).toHaveBeenCalledWith(null);
      expect(mockManageInvoice).toHaveBeenCalledTimes(1);
      expect(mockManageInvoice).toHaveBeenCalledWith(
        null,
        "tok-abc",
        expect.arrayContaining([expect.objectContaining({ index: 1, operation: "CREATE" })])
      );
      expect(Object.keys(result).sort()).toEqual(
        ["invoiceXml", "mode", "status", "submissionId", "transactionId"].sort()
      );
    });
  });
});
