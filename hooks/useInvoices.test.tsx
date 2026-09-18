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
