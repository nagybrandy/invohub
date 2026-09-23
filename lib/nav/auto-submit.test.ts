// lib/nav/auto-submit.test.ts
import {
  autoSubmitToNavOnFinalize,
  isFinalizationTransition,
  isNavAutoSubmitConfigured,
} from "@/lib/nav/auto-submit";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import type { Company } from "@/lib/companies/service";

const mockGetCompanyByUserId = jest.fn();
jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: (...args: unknown[]) => mockGetCompanyByUserId(...args),
}));

const mockSubmit = jest.fn();
jest.mock("@/lib/nav/submit-outgoing", () => ({
  submitOutgoingInvoiceToNav: (...args: unknown[]) => mockSubmit(...args),
}));
jest.mock("@/lib/nav/serialize-submission", () => ({
  serializeNavSubmission: (s: { id: string; status: string } | null) =>
    s ? { submissionId: s.id, status: s.status } : null,
}));

const mockHasOwn = jest.fn();
const mockShared = jest.fn();
jest.mock("@/lib/nav/resolve-credentials", () => ({
  hasOwnNavCredentials: (...args: unknown[]) => mockHasOwn(...args),
  isSharedNavTestAccountConfigured: () => mockShared(),
}));

function company(overrides: Partial<Company> = {}): Company {
  return { id: "c1", userId: "u1", name: "Minta EV", createdAt: "", updatedAt: "", ...overrides };
}

describe("isNavAutoSubmitConfigured", () => {
  beforeEach(() => {
    mockHasOwn.mockReturnValue(false);
    mockShared.mockReturnValue(false);
  });

  it("is off without a company profile (no supplier data to report)", () => {
    expect(isNavAutoSubmitConfigured(null)).toBe(false);
  });

  it("is on in demo mode (the default) — the in-process simulator, no NAV account", () => {
    expect(isNavAutoSubmitConfigured(company({ navEnvironment: "demo" }))).toBe(true);
    expect(isNavAutoSubmitConfigured(company({ navEnvironment: undefined }))).toBe(true);
  });

  it("is on in test mode only when own or shared test credentials exist", () => {
    expect(isNavAutoSubmitConfigured(company({ navEnvironment: "test" }))).toBe(false);
    mockShared.mockReturnValue(true);
    expect(isNavAutoSubmitConfigured(company({ navEnvironment: "test" }))).toBe(true);
    mockShared.mockReturnValue(false);
    mockHasOwn.mockReturnValue(true);
    expect(isNavAutoSubmitConfigured(company({ navEnvironment: "test" }))).toBe(true);
  });

  it("is never on for production — automatic production reporting is not enabled by this slice", () => {
    mockHasOwn.mockReturnValue(true);
    expect(isNavAutoSubmitConfigured(company({ navEnvironment: "production" }))).toBe(false);
  });
});

describe("isFinalizationTransition", () => {
  const draft = makeInvoice({ status: "draft", invoiceNumber: "" });
  const finalized = makeInvoice({ status: "unpaid", invoiceNumber: "INV-2026-001" });

  it("is true for draft -> finalized and for a brand-new finalized document (e.g. storno)", () => {
    expect(isFinalizationTransition(draft, finalized)).toBe(true);
    expect(isFinalizationTransition(null, finalized)).toBe(true);
  });

  it("is false for an edit of an already-finalized document (legacy, never auto-reported on e.g. mark-paid)", () => {
    expect(isFinalizationTransition(finalized, { ...finalized, status: "paid" })).toBe(false);
  });

  it("is false when the result is still a draft", () => {
    expect(isFinalizationTransition(null, draft)).toBe(false);
    expect(isFinalizationTransition(draft, draft)).toBe(false);
  });

  it.each(["invoice", "advance", "storno", "modify"] as const)("covers %s", (documentType) => {
    expect(isFinalizationTransition(null, { ...finalized, documentType })).toBe(true);
  });

  it("never for a díjbekérő", () => {
    expect(
      isFinalizationTransition(draft, { ...finalized, documentType: "proforma", status: "proforma" })
    ).toBe(false);
  });
});

describe("autoSubmitToNavOnFinalize", () => {
  const draft = makeInvoice({ status: "draft", invoiceNumber: "" });
  const finalized = makeInvoice({ status: "unpaid", invoiceNumber: "INV-2026-001" });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompanyByUserId.mockResolvedValue(company({ navEnvironment: "demo" }));
    mockSubmit.mockResolvedValue({ kind: "submitted", submission: { id: "s1", status: "sent" }, invoiceXml: "<x/>" });
  });

  it("submits on finalization and returns the serialized submission", async () => {
    const result = await autoSubmitToNavOnFinalize("u1", draft, finalized);
    expect(mockSubmit).toHaveBeenCalledWith("u1", finalized);
    expect(result).toEqual({ outcome: "submitted", submission: { submissionId: "s1", status: "sent" } });
  });

  it("does nothing (null) when it isn't a finalization", async () => {
    expect(await autoSubmitToNavOnFinalize("u1", finalized, finalized)).toBeNull();
    expect(mockGetCompanyByUserId).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("does nothing (null) when NAV isn't configured", async () => {
    mockGetCompanyByUserId.mockResolvedValue(null);
    expect(await autoSubmitToNavOnFinalize("u1", draft, finalized)).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("passes a recorded failure through without throwing (the save itself succeeded)", async () => {
    mockSubmit.mockResolvedValue({ kind: "failed", submission: { id: "s1", status: "error" }, error: "boom" });
    expect(await autoSubmitToNavOnFinalize("u1", draft, finalized)).toEqual({
      outcome: "failed",
      submission: { submissionId: "s1", status: "error" },
      error: "boom",
    });
  });

  it("reports a refusal (e.g. missing exchange rate) as rejected with its code", async () => {
    mockSubmit.mockResolvedValue({ kind: "rejected", code: "missingExchangeRate", httpStatus: 409 });
    expect(await autoSubmitToNavOnFinalize("u1", draft, finalized)).toEqual({
      outcome: "rejected",
      submission: null,
      code: "missingExchangeRate",
    });
  });

  it("swallows an unexpected exception into a failed result", async () => {
    mockSubmit.mockRejectedValue(new Error("db down"));
    expect(await autoSubmitToNavOnFinalize("u1", draft, finalized)).toEqual({
      outcome: "failed",
      submission: null,
      error: "db down",
    });
  });
});
