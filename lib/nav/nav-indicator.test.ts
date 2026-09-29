// lib/nav/nav-indicator.test.ts
import { navIndicatorFor, type NavListStatus } from "@/lib/nav/nav-indicator";

const doc = (status: string, documentType = "invoice") => ({ status, documentType });

describe("navIndicatorFor — what the list dot should actually mean", () => {
  it("shows nothing for a draft or a díjbekérő: there is nothing to report", () => {
    expect(navIndicatorFor(doc("draft"), undefined)).toBe("none");
    expect(navIndicatorFor(doc("proforma", "proforma"), undefined)).toBe("none");
    // even if a submission row somehow exists, a díjbekérő never reports
    expect(navIndicatorFor(doc("unpaid", "proforma"), "done")).toBe("none");
  });

  it("marks a finalized invoice with no submission as not submitted — never as 'probably submitted'", () => {
    expect(navIndicatorFor(doc("unpaid"), undefined)).toBe("notSubmitted");
    expect(navIndicatorFor(doc("paid"), null)).toBe("notSubmitted");
  });

  it("treats every transitional NAV state as in progress", () => {
    for (const s of ["pending", "sent", "processing", "received", "saved"] as const) {
      expect(navIndicatorFor(doc("unpaid"), s)).toBe<NavListStatus>("inProgress");
    }
  });

  it("marks DONE as submitted", () => {
    expect(navIndicatorFor(doc("unpaid"), "done")).toBe("done");
  });

  it("marks an error or an ABORTED submission as failed — the state that needs a human", () => {
    expect(navIndicatorFor(doc("unpaid"), "error")).toBe("failed");
    expect(navIndicatorFor(doc("sent"), "aborted")).toBe("failed");
  });

  it("is case-tolerant, since the status check writes NAV's own upper-case values lower-cased", () => {
    expect(navIndicatorFor(doc("unpaid"), "DONE" as never)).toBe("done");
  });

  it("reports storno and helyesbítő documents like any invoice", () => {
    expect(navIndicatorFor(doc("sent", "storno"), "done")).toBe("done");
    expect(navIndicatorFor(doc("sent", "modify"), undefined)).toBe("notSubmitted");
  });
});
