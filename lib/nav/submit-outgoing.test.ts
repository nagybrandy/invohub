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
});
