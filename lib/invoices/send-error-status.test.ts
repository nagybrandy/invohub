// lib/invoices/send-error-status.test.ts
import { statusForSendFailure } from "@/lib/invoices/send-error-status";

describe("statusForSendFailure", () => {
  it.each([
    ["invoiceNotFound", 404],
    ["companyProfileIncomplete", 422],
    ["buyerAddressMissing", 422],
    ["noRecipient", 422],
    ["templateNotFound", 500],
    ["pdfFailed", 500],
    ["emailSendFailed", 502],
  ])("maps code %s to status %d", (code, status) => {
    expect(statusForSendFailure({ code, error: "irrelevant" })).toBe(status);
  });

  it("falls back to 404 when there's no code but the error mentions 'not found' (legacy callers)", () => {
    expect(statusForSendFailure({ error: "Invoice not found." })).toBe(404);
  });

  it("falls back to 500 for an unknown/missing code", () => {
    expect(statusForSendFailure({ error: "Something else broke." })).toBe(500);
    expect(statusForSendFailure({})).toBe(500);
  });
});

describe("statusForSendFailure — concurrent finalize", () => {
  it("maps invoiceFinalized (another request finalized the draft first) to 409", () => {
    expect(statusForSendFailure({ code: "invoiceFinalized" })).toBe(409);
  });
});
