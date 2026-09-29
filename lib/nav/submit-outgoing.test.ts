// lib/nav/submit-outgoing.test.ts
// Guarded, idempotent NAV submission. Never touches a real NAV endpoint: the
// client factory is mocked, and the only modes exercised are demo/test.
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

const mockGetCompanyByUserId = jest.fn();
jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: (...args: unknown[]) => mockGetCompanyByUserId(...args),
}));

const mockGetInvoiceById = jest.fn();
const mockFindInvoicesReferencing = jest.fn();
jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: (...args: unknown[]) => mockGetInvoiceById(...args),
  findInvoicesReferencing: (...args: unknown[]) => mockFindInvoicesReferencing(...args),
}));

const mockGetClientById = jest.fn();
jest.mock("@/lib/clients/service", () => ({
  getClientById: (...args: unknown[]) => mockGetClientById(...args),
}));

const mockHasSuccessfulNavSubmission = jest.fn();
jest.mock("@/lib/nav/submission-history", () => ({
  hasSuccessfulNavSubmission: (...args: unknown[]) => mockHasSuccessfulNavSubmission(...args),
}));

const mockClaim = jest.fn();
const mockRelease = jest.fn();
const mockMarkSent = jest.fn();
const mockMarkFailed = jest.fn();
const mockListRecords = jest.fn();
const mockGetRecord = jest.fn();
jest.mock("@/lib/nav/submission-store", () => ({
  claimNavSubmission: (...args: unknown[]) => mockClaim(...args),
  releaseNavSubmissionClaim: (...args: unknown[]) => mockRelease(...args),
  markNavSubmissionSent: (...args: unknown[]) => mockMarkSent(...args),
  markNavSubmissionFailed: (...args: unknown[]) => mockMarkFailed(...args),
  listNavSubmissionRecords: (...args: unknown[]) => mockListRecords(...args),
  getNavSubmissionRecord: (...args: unknown[]) => mockGetRecord(...args),
}));

const mockTokenExchange = jest.fn();
const mockManageInvoice = jest.fn();
const mockGetNavClient = jest.fn((_mode: string) => ({
  environment: "demo",
  tokenExchange: mockTokenExchange,
  manageInvoice: mockManageInvoice,
  queryTransactionStatus: jest.fn(),
  queryTaxpayer: jest.fn(),
}));
jest.mock("@/lib/nav/client", () => ({
  getNavClient: (mode: string) => mockGetNavClient(mode),
}));

const mockResolveNavCredentials = jest.fn();
jest.mock("@/lib/nav/resolve-credentials", () => ({
  resolveNavCredentials: (...args: unknown[]) => mockResolveNavCredentials(...args),
}));

const NOW = new Date();
function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "claim-1",
    invoiceId: "inv-1",
    status: "pending",
    mode: "demo",
    transactionId: null,
    errorMessage: null,
    messages: null,
    checkedAt: null,
    submittedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function lastXml(): string {
  const ops = mockManageInvoice.mock.calls.at(-1)![2] as Array<{ invoiceDataBase64: string }>;
  return Buffer.from(ops[0].invoiceDataBase64, "base64").toString("utf8");
}

describe("submitOutgoingInvoiceToNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23" });
    mockTokenExchange.mockResolvedValue({ exchangeToken: "tok-abc" });
    mockManageInvoice.mockResolvedValue({ transactionId: "NAV-TXN-TEST" });
    mockHasSuccessfulNavSubmission.mockResolvedValue(false);
    mockFindInvoicesReferencing.mockResolvedValue([]);
    mockGetClientById.mockResolvedValue(null);
    mockClaim.mockResolvedValue("claim-1");
    // before claim: nothing; after claim: only our own claim row.
    mockListRecords.mockResolvedValueOnce([]).mockResolvedValue([record()]);
    mockGetRecord.mockImplementation(async (_invoiceId: string, id: string) =>
      record({ id, status: "sent", transactionId: "NAV-TXN-TEST" })
    );
  });

  it("demo mode: claims, submits CREATE through the simulator, marks the claim sent — never resolves real credentials", async () => {
    const outcome = await submitOutgoingInvoiceToNav("user-1", makeInvoice());

    expect(mockGetNavClient).toHaveBeenCalledWith("demo");
    expect(mockResolveNavCredentials).not.toHaveBeenCalled();
    expect(mockClaim).toHaveBeenCalledWith("inv-1", "demo");
    expect(mockManageInvoice).toHaveBeenCalledWith(
      null,
      "tok-abc",
      [expect.objectContaining({ index: 1, operation: "CREATE" })]
    );
    expect(mockMarkSent).toHaveBeenCalledWith("claim-1", "NAV-TXN-TEST");
    expect(outcome.kind).toBe("submitted");
    if (outcome.kind !== "submitted") throw new Error();
    expect(outcome.submission.transactionId).toBe("NAV-TXN-TEST");
    expect(outcome.invoiceXml).toContain("<invoiceNumber>");
  });

  it("test mode: resolves credentials and uses the test client", async () => {
    mockGetCompanyByUserId.mockResolvedValue({ name: "Demo Kft.", taxNumber: "12345678-1-23", navEnvironment: "test" });
    const creds = { login: "l", environment: "test" };
    mockResolveNavCredentials.mockReturnValue(creds);

    await submitOutgoingInvoiceToNav("user-1", makeInvoice());

    expect(mockGetNavClient).toHaveBeenCalledWith("test");
    expect(mockTokenExchange).toHaveBeenCalledWith(creds);
    expect(mockClaim).toHaveBeenCalledWith("inv-1", "test");
  });

  describe("refusals (no claim, no NAV call)", () => {
    it.each([
      ["draft", makeInvoice({ status: "draft", invoiceNumber: "" }), "draftNotSubmittable", 409],
      ["proforma", makeInvoice({ documentType: "proforma", status: "proforma" }), "proformaNotSubmittable", 422],
      ["missing rate", makeInvoice({ currency: "EUR", exchangeRate: undefined }), "missingExchangeRate", 409],
    ])("%s", async (_label, invoice, code, httpStatus) => {
      const outcome = await submitOutgoingInvoiceToNav("user-1", invoice);
      expect(outcome).toEqual({ kind: "rejected", code, httpStatus });
      expect(mockClaim).not.toHaveBeenCalled();
      expect(mockManageInvoice).not.toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    it.each(["sent", "processing", "done", "DONE"])(
      "returns the existing %s submission instead of submitting again",
      async (status) => {
        const existing = record({ id: "old", status, transactionId: "TX-OLD" });
        mockListRecords.mockReset().mockResolvedValue([existing]);

        const outcome = await submitOutgoingInvoiceToNav("user-1", makeInvoice());

        expect(outcome).toEqual({ kind: "existing", submission: existing });
        expect(mockClaim).not.toHaveBeenCalled();
        expect(mockManageInvoice).not.toHaveBeenCalled();
      }
    );

    it("allows a retry after an error/aborted submission", async () => {
      mockListRecords
        .mockReset()
        .mockResolvedValueOnce([record({ id: "old", status: "aborted" })])
        .mockResolvedValue([record({ id: "old", status: "aborted" }), record()]);

      const outcome = await submitOutgoingInvoiceToNav("user-1", makeInvoice());
      expect(outcome.kind).toBe("submitted");
      expect(mockManageInvoice).toHaveBeenCalledTimes(1);
    });

    it("backs off (releases its claim, no NAV call) when a concurrent request claimed first", async () => {
      const earlier = record({ id: "other-claim", createdAt: new Date(NOW.getTime() - 1000) });
      mockListRecords.mockReset().mockResolvedValueOnce([]).mockResolvedValue([record(), earlier]);

      const outcome = await submitOutgoingInvoiceToNav("user-1", makeInvoice());

      expect(outcome).toEqual({ kind: "existing", submission: earlier });
      expect(mockRelease).toHaveBeenCalledWith("claim-1");
      expect(mockManageInvoice).not.toHaveBeenCalled();
    });
  });

  it("records a failure (status error + message) instead of throwing when NAV fails", async () => {
    mockManageInvoice.mockRejectedValue(new Error("INVALID_SECURITY_USER"));
    mockGetRecord.mockResolvedValue(record({ status: "error", errorMessage: "INVALID_SECURITY_USER" }));

    const outcome = await submitOutgoingInvoiceToNav("user-1", makeInvoice());

    expect(mockMarkFailed).toHaveBeenCalledWith("claim-1", "INVALID_SECURITY_USER");
    expect(mockMarkSent).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("failed");
    if (outcome.kind !== "failed") throw new Error();
    expect(outcome.error).toBe("INVALID_SECURITY_USER");
    expect(outcome.submission.status).toBe("error");
  });

  it("records a failure when the storno reference is missing (XML never built, NAV never called)", async () => {
    const outcome = await submitOutgoingInvoiceToNav(
      "user-1",
      makeInvoice({ documentType: "storno", originalInvoiceId: undefined })
    );
    expect(outcome.kind).toBe("failed");
    expect(mockMarkFailed).toHaveBeenCalledWith("claim-1", expect.stringMatching(/missing its reference/));
    expect(mockManageInvoice).not.toHaveBeenCalled();
  });

  describe("customer data", () => {
    it("loads the linked partner and reports a DOMESTIC buyer's address", async () => {
      mockGetClientById.mockResolvedValue({
        id: "cl-1",
        userId: "user-1",
        name: "Acme Kft.",
        country: "HU",
        zipCode: "1052",
        city: "Budapest",
        address: "Váci utca 1.",
        createdAt: "",
        updatedAt: "",
      });
      await submitOutgoingInvoiceToNav("user-1", makeInvoice({ clientId: "cl-1" }));

      expect(mockGetClientById).toHaveBeenCalledWith("user-1", "cl-1");
      const xml = lastXml();
      expect(xml).toContain("<customerVatStatus>DOMESTIC</customerVatStatus>");
      expect(xml).toContain("<customerAddress>");
      expect(xml).toContain("<base:additionalAddressDetail>Váci utca 1.</base:additionalAddressDetail>");
    });

    it("reports a partner marked private person as PRIVATE_PERSON with no name", async () => {
      mockGetClientById.mockResolvedValue({
        id: "cl-2",
        userId: "user-1",
        name: "Kiss Anna",
        partyType: "private_person",
        createdAt: "",
        updatedAt: "",
      });
      await submitOutgoingInvoiceToNav("user-1", makeInvoice({ clientId: "cl-2", clientName: "Kiss Anna", clientTaxNumber: undefined }));
      const xml = lastXml();
      expect(xml).toContain("<customerVatStatus>PRIVATE_PERSON</customerVatStatus>");
      expect(xml).not.toContain("Kiss Anna");
    });
  });

  describe("storno / helyesbítő", () => {
    const original = makeInvoice({
      id: "inv-original",
      invoiceNumber: "INV-2026-042",
      lineItems: [makeLineItem({ id: "o1" }), makeLineItem({ id: "o2" })],
    });

    it("storno: STORNO operation, reference to the original, modificationIndex 1, lines continue after the original's", async () => {
      mockGetInvoiceById.mockResolvedValue(original);
      mockHasSuccessfulNavSubmission.mockResolvedValue(true);
      const storno = makeInvoice({
        id: "inv-storno",
        invoiceNumber: "STO-2026-001",
        documentType: "storno",
        originalInvoiceId: "inv-original",
        lineItems: [makeLineItem({ id: "s1", quantity: -1 }), makeLineItem({ id: "s2", quantity: -1 })],
      });

      const outcome = await submitOutgoingInvoiceToNav("user-1", storno);

      expect(outcome.kind).toBe("submitted");
      expect(mockManageInvoice.mock.calls[0][2][0].operation).toBe("STORNO");
      const xml = lastXml();
      expect(xml).toContain("<originalInvoiceNumber>INV-2026-042</originalInvoiceNumber>");
      expect(xml).toContain("<modifyWithoutMaster>false</modifyWithoutMaster>");
      expect(xml).toContain("<modificationIndex>1</modificationIndex>");
      expect(xml).toContain("<lineNumberReference>3</lineNumberReference>");
      expect(xml).toContain("<lineNumberReference>4</lineNumberReference>");
    });

    it("modify after an already-reported helyesbítő: MODIFY, modificationIndex 2, line numbers continue after the whole chain", async () => {
      mockGetInvoiceById.mockResolvedValue(original);
      const earlierModify = makeInvoice({
        id: "inv-mod-1",
        invoiceNumber: "HEL-2026-001",
        documentType: "modify",
        modifiesInvoiceId: "inv-original",
        lineItems: [makeLineItem({ id: "m1" })],
      });
      const abandonedDraft = makeInvoice({
        id: "inv-mod-draft",
        invoiceNumber: "",
        status: "draft",
        documentType: "modify",
        modifiesInvoiceId: "inv-original",
      });
      const current = makeInvoice({
        id: "inv-mod-2",
        invoiceNumber: "HEL-2026-002",
        documentType: "modify",
        modifiesInvoiceId: "inv-original",
        modificationIndex: 3, // persisted draft counter (counts abandoned drafts) — not what NAV gets
      });
      mockFindInvoicesReferencing.mockImplementation(async (_u: string, field: string) =>
        field === "modifiesInvoiceId" ? [earlierModify, abandonedDraft, current] : []
      );
      mockListRecords.mockReset().mockImplementation(async (invoiceId: string) => {
        if (invoiceId === "inv-mod-1") return [record({ id: "x", invoiceId, status: "done" })];
        if (invoiceId === "inv-mod-2") return mockListRecords.mock.calls.filter((c) => c[0] === "inv-mod-2").length > 1 ? [record({ invoiceId })] : [];
        return [];
      });

      await submitOutgoingInvoiceToNav("user-1", current);

      expect(mockManageInvoice.mock.calls[0][2][0].operation).toBe("MODIFY");
      const xml = lastXml();
      expect(xml).toContain("<modificationIndex>2</modificationIndex>");
      // original has 2 lines + the earlier helyesbítő's 1 line -> next is 4.
      expect(xml).toContain("<lineNumberReference>4</lineNumberReference>");
    });

    it("modifyWithoutMaster=true when the original was never successfully reported", async () => {
      mockGetInvoiceById.mockResolvedValue(original);
      mockHasSuccessfulNavSubmission.mockResolvedValue(false);
      await submitOutgoingInvoiceToNav(
        "user-1",
        makeInvoice({ id: "inv-storno", documentType: "storno", originalInvoiceId: "inv-original" })
      );
      expect(lastXml()).toContain("<modifyWithoutMaster>true</modifyWithoutMaster>");
    });

    it("a plain CREATE never looks up a reference", async () => {
      await submitOutgoingInvoiceToNav("user-1", makeInvoice());
      expect(mockGetInvoiceById).not.toHaveBeenCalled();
      expect(lastXml()).not.toContain("<invoiceReference>");
    });
  });
});
