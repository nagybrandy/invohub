// hooks/useInvoices.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useInvoices } from "@/hooks/useInvoices";
import { apiFetch } from "@/lib/api/client";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { filterInvoicesByStatus } from "@/lib/invoices/filter-invoices";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderUseInvoices() {
  const ref: { current: ReturnType<typeof useInvoices> | null } = { current: null };

  function HookHost() {
    ref.current = useInvoices();
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });

  return ref;
}

describe("useInvoices", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({
      invoices: [
        makeInvoice({ id: "1", status: "paid" }),
        makeInvoice({ id: "2", status: "overdue" }),
        makeInvoice({ id: "3", status: "sent" }),
      ],
      total: 3,
      limit: 30,
      offset: 0,
      stats: { count: 3, thisMonthCount: 2, monthlyTotal: 1000 },
    });
  });

  it("loads invoices on mount", async () => {
    const ref = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.invoices).toHaveLength(3);
    expect(ref.current?.stats.count).toBe(3);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices?limit=30");
  });

  it("supports list status filters on loaded invoices", async () => {
    const ref = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    const invoices = ref.current?.invoices ?? [];
    expect(filterInvoicesByStatus(invoices, "paid")).toHaveLength(1);
    expect(filterInvoicesByStatus(invoices, "overdue")[0]?.id).toBe("2");
    expect(filterInvoicesByStatus(invoices, "all")).toHaveLength(3);
  });

  it("surfaces API errors", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const ref = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.error).toBe("Network error");
  });
});
