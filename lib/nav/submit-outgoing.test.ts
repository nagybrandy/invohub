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

  it("submits documentType=storno invoices with the STORNO operation", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    const invoice = makeInvoice({ documentType: "storno", originalInvoiceId: "inv-original" });

    await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockManageInvoice).toHaveBeenCalledWith(
      null,
      "tok-abc",
      expect.arrayContaining([expect.objectContaining({ index: 1, operation: "STORNO" })])
    );
  });

  it("submits documentType=modify invoices with the MODIFY operation", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    const invoice = makeInvoice({
      documentType: "modify",
      modifiesInvoiceId: "inv-original",
      modificationIndex: 1,
    });

    await submitOutgoingInvoiceToNav("user-1", invoice);

    expect(mockManageInvoice).toHaveBeenCalledWith(
      null,
      "tok-abc",
      expect.arrayContaining([expect.objectContaining({ index: 1, operation: "MODIFY" })])
    );
  });
});
