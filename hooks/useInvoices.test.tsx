// hooks/useInvoices.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useInvoices } from "@/hooks/useInvoices";
import { apiFetch } from "@/lib/api/client";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderUseInvoices(
  options?: Parameters<typeof useInvoices>[0],
) {
  const ref: { current: ReturnType<typeof useInvoices> | null } = { current: null };

  function HookHost() {
    ref.current = useInvoices(options);
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
      invoices: [makeInvoice()],
      total: 1,
      limit: 30,
      offset: 0,
      stats: { count: 1, thisMonthCount: 1, monthlyTotal: 1000 },
    });
  });

  it("loads invoices on mount", async () => {
    const ref = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.invoices).toHaveLength(1);
    expect(ref.current?.stats.count).toBe(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices?limit=30");
  });

  it("forwards status and search filters to the API", async () => {
    await renderUseInvoices({ status: "draft", search: "Acme" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/invoices?limit=30&status=draft&search=Acme",
    );
  });

  it("forwards needsExchangeRate=1 when requested", async () => {
    await renderUseInvoices({ needsExchangeRate: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/invoices?limit=30&needsExchangeRate=1",
    );
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

  it("exposes convertedProformaIds from the response (AC13)", async () => {
    mockApiFetch.mockResolvedValue({
      invoices: [makeInvoice({ id: "proforma-1", documentType: "proforma" })],
      total: 1,
      limit: 30,
      offset: 0,
      stats: { count: 1, thisMonthCount: 1, monthlyTotal: 1000 },
      convertedProformaIds: { "proforma-1": "converted-inv-1" },
    });
    const ref = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.convertedProformaIds).toEqual({ "proforma-1": "converted-inv-1" });
  });

  it("defaults convertedProformaIds to {} when the response omits it, and on error (AC13)", async () => {
    mockApiFetch.mockResolvedValue({
      invoices: [makeInvoice()],
      total: 1,
      limit: 30,
      offset: 0,
      stats: { count: 1, thisMonthCount: 1, monthlyTotal: 1000 },
    });
    const ref = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.convertedProformaIds).toEqual({});

    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const errorRef = await renderUseInvoices();
    await act(async () => {
      await Promise.resolve();
    });
    expect(errorRef.current?.convertedProformaIds).toEqual({});
  });
});

describe("useInvoices — month filter and load more", () => {
  const inv = (id: string) => makeInvoice({ id, invoiceNumber: `INV-${id}` });

  it("sends the month to the API and resets to the first page when it changes", async () => {
    mockApiFetch.mockResolvedValue({ invoices: [inv("a")], total: 1, limit: 30, offset: 0, stats: { count: 1, thisMonthCount: 1, monthlyTotal: 1 } });
    await renderUseInvoices({ month: "2026-09" });
    const url = String(mockApiFetch.mock.calls.at(-1)?.[0]);
    expect(url).toContain("month=2026-09");
    expect(url).not.toContain("offset=");
  });

  it("appends the next page on loadMore and knows when there is no more", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ invoices: [inv("a"), inv("b")], total: 3, limit: 2, offset: 0, stats: { count: 3, thisMonthCount: 0, monthlyTotal: 0 } })
      .mockResolvedValueOnce({ invoices: [inv("c")], total: 3, limit: 2, offset: 2, stats: { count: 3, thisMonthCount: 0, monthlyTotal: 0 } });

    const ref = await renderUseInvoices({ pageSize: 2 });
    expect(ref.current!.invoices.map((i) => i.id)).toEqual(["a", "b"]);
    expect(ref.current!.hasMore).toBe(true);

    await act(async () => {
      await ref.current!.loadMore();
    });

    expect(String(mockApiFetch.mock.calls.at(-1)?.[0])).toContain("offset=2");
    expect(ref.current!.invoices.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(ref.current!.hasMore).toBe(false);
  });
});
