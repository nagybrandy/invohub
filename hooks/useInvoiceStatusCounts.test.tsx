// hooks/useInvoiceStatusCounts.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useInvoiceStatusCounts } from "@/hooks/useInvoiceStatusCounts";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useInvoiceStatusCounts> | null } = { current: null };
  function HookHost() {
    ref.current = useInvoiceStatusCounts();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return ref;
}

describe("useInvoiceStatusCounts", () => {
  it("fetches its own unfiltered grand total plus a total per tracked status, and derives 'other'", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.includes("status=draft")) return Promise.resolve({ total: 2 });
      if (path.includes("status=sent")) return Promise.resolve({ total: 3 });
      if (path.includes("status=unpaid")) return Promise.resolve({ total: 1 });
      if (path.includes("status=overdue")) return Promise.resolve({ total: 2 });
      if (path.includes("status=paid")) return Promise.resolve({ total: 5 });
      // /api/invoices?limit=1 — the unfiltered grand total.
      return Promise.resolve({ total: 15 });
    });

    const ref = await renderHook();

    expect(ref.current?.allCount).toBe(15);
    expect(ref.current?.counts.draft).toBe(2);
    expect(ref.current?.counts.paid).toBe(5);
    // 15 total - (2+3+1+2+5)=13 known => 2 "other" (proforma/partially_paid/cancelled).
    expect(ref.current?.other).toBe(2);
    expect(ref.current?.loading).toBe(false);
  });

  it("does not let an active status filter elsewhere on the page change the grand total", async () => {
    // Regression test: allCount must come from the hook's OWN unfiltered
    // request, never from a caller's currently-filtered `total` — the
    // "Összes" chip must show every invoice, not just the active filter's.
    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/api/invoices?limit=1") return Promise.resolve({ total: 12 });
      return Promise.resolve({ total: 0 });
    });

    const ref = await renderHook();

    expect(ref.current?.allCount).toBe(12);
  });
});
