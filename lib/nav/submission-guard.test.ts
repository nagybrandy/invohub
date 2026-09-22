// lib/nav/submission-guard.test.ts
import {
  checkNavSubmittable,
  isNavReportableDocumentType,
  pickBlockingSubmission,
  STALE_PENDING_MS,
} from "@/lib/nav/submission-guard";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("isNavReportableDocumentType", () => {
  it("reports számla-type documents and never a díjbekérő (proforma is not an invoice for NAV)", () => {
    expect(isNavReportableDocumentType("invoice")).toBe(true);
    expect(isNavReportableDocumentType("advance")).toBe(true);
    expect(isNavReportableDocumentType("storno")).toBe(true);
    expect(isNavReportableDocumentType("modify")).toBe(true);
    expect(isNavReportableDocumentType("proforma")).toBe(false);
  });
});

describe("checkNavSubmittable", () => {
  it("accepts a finalized invoice", () => {
    expect(checkNavSubmittable(makeInvoice({ status: "unpaid" }))).toEqual({ ok: true });
  });

  it("accepts a cancelled (stornózott) original — it was still issued and must be reportable", () => {
    expect(checkNavSubmittable(makeInvoice({ status: "cancelled" }))).toEqual({ ok: true });
  });

  it("rejects a draft with 409 draftNotSubmittable", () => {
    expect(checkNavSubmittable(makeInvoice({ status: "draft", invoiceNumber: "" }))).toEqual({
      ok: false,
      code: "draftNotSubmittable",
      httpStatus: 409,
    });
  });

  it("treats a non-draft without an invoice number as a draft too (nothing to report yet)", () => {
    expect(checkNavSubmittable(makeInvoice({ status: "unpaid", invoiceNumber: "" }))).toMatchObject({
      ok: false,
      code: "draftNotSubmittable",
    });
  });

  it("rejects a díjbekérő with 422 proformaNotSubmittable", () => {
    expect(
      checkNavSubmittable(makeInvoice({ documentType: "proforma", status: "proforma", invoiceNumber: "DBK-2026-001" }))
    ).toEqual({ ok: false, code: "proformaNotSubmittable", httpStatus: 422 });
  });

  it("rejects a non-HUF invoice without a rate with 409 missingExchangeRate", () => {
    expect(checkNavSubmittable(makeInvoice({ currency: "EUR", exchangeRate: undefined }))).toEqual({
      ok: false,
      code: "missingExchangeRate",
      httpStatus: 409,
    });
  });
});

describe("pickBlockingSubmission", () => {
  const now = new Date("2026-09-22T12:00:00.000Z");
  const row = (id: string, status: string, createdAt: string) => ({ id, status, createdAt: new Date(createdAt) });

  it("returns null when there is nothing, or only failed (error/aborted) submissions — a retry is allowed", () => {
    expect(pickBlockingSubmission([], now)).toBeNull();
    expect(
      pickBlockingSubmission(
        [row("a", "error", "2026-09-22T11:00:00Z"), row("b", "aborted", "2026-09-22T11:10:00Z")],
        now
      )
    ).toBeNull();
  });

  it("blocks on an in-progress (sent/received/processing/saved/pending) or DONE submission", () => {
    for (const status of ["pending", "sent", "received", "processing", "saved", "done"]) {
      expect(pickBlockingSubmission([row("a", status, "2026-09-22T11:59:00Z")], now)?.id).toBe("a");
    }
  });

  it("status matching is case-insensitive (NAV returns DONE, rows store done)", () => {
    expect(pickBlockingSubmission([row("a", "DONE", "2026-09-22T11:00:00Z")], now)?.id).toBe("a");
  });

  it("returns the OLDEST blocking row (deterministic winner when two requests race), tie-broken by id", () => {
    const rows = [
      row("z-new", "pending", "2026-09-22T11:59:30Z"),
      row("b", "sent", "2026-09-22T11:59:00Z"),
      row("a", "pending", "2026-09-22T11:59:00Z"),
    ];
    expect(pickBlockingSubmission(rows, now)?.id).toBe("a");
  });

  it("ignores a pending claim older than the stale window (a crashed request must not block forever)", () => {
    const stale = new Date(now.getTime() - STALE_PENDING_MS - 1000).toISOString();
    expect(pickBlockingSubmission([row("a", "pending", stale)], now)).toBeNull();
  });
});
