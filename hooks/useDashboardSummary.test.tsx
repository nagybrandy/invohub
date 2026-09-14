// hooks/useDashboardSummary.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useDashboardSummary } from "@/hooks/useDashboardSummary";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useDashboardSummary> | null } = { current: null };

  function HookHost() {
    ref.current = useDashboardSummary();
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });

  return ref;
}

describe("useDashboardSummary", () => {
  it("loads the summary from /api/dashboard/summary on mount, plus the draft count", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith("/api/invoices")) {
        return Promise.resolve({ total: 3 });
      }
      return Promise.resolve({
        summary: {
          revenue: 127_000,
          outstanding: 88_900,
          overdueTotal: 25_400,
          issuedTotal: 0,
          estimatedVat: 27_000,
          overdueCount: 1,
          oldestOverdueDays: 11,
          recentInvoices: [],
        },
      });
    });

    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/dashboard/summary");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices?status=draft&limit=1");
    expect(ref.current?.summary.revenue).toBe(127_000);
    expect(ref.current?.summary.overdueCount).toBe(1);
    expect(ref.current?.draftCount).toBe(3);
    expect(ref.current?.loading).toBe(false);
  });

  it("surfaces a load error and keeps the empty summary", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });

    expect(ref.current?.error).toBe("Network error");
    expect(ref.current?.summary.revenue).toBe(0);
  });
});
