// lib/invoices/export-fetch.test.ts
import { EXPORT_ROW_CAP, fetchAllInvoicesForExport } from "@/lib/invoices/export-fetch";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("@/lib/api/client", () => ({ apiFetch: jest.fn() }));

const page = (ids: string[], total: number) => ({ invoices: ids.map((id) => makeInvoice({ id })), total });

describe("fetchAllInvoicesForExport — the whole filtered list, not the first page", () => {
  it("walks the API in max-size pages until it holds every row", async () => {
    const calls: string[] = [];
    const fetchPage = jest.fn(async (q: string) => {
      calls.push(q);
      const offset = Number(new URLSearchParams(q).get("offset") ?? 0);
      const ids = Array.from({ length: Math.min(100, 250 - offset) }, (_, i) => `inv-${offset + i}`);
      return page(ids, 250);
    });
    const result = await fetchAllInvoicesForExport({ status: "paid", month: "2026-09" }, fetchPage);
    expect(result.invoices).toHaveLength(250);
    expect(result.truncated).toBe(false);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("limit=100");
    expect(calls[0]).not.toContain("offset=");
    expect(calls[1]).toContain("offset=100");
    expect(calls[2]).toContain("offset=200");
    expect(calls[0]).toContain("status=paid");
    expect(calls[0]).toContain("month=2026-09");
  });

  it("stops on an empty page rather than looping when the total is stale", async () => {
    const fetchPage = jest.fn(async () => page([], 40));
    const result = await fetchAllInvoicesForExport({}, fetchPage);
    expect(result.invoices).toHaveLength(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("drops a row that shifted between pages instead of exporting it twice", async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(["a", "b"], 3))
      .mockResolvedValueOnce(page(["b", "c"], 3));
    const result = await fetchAllInvoicesForExport({}, fetchPage);
    expect(result.invoices.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("caps the export and says so", async () => {
    const fetchPage = jest.fn(async (q: string) => {
      const offset = Number(new URLSearchParams(q).get("offset") ?? 0);
      return page(Array.from({ length: 100 }, (_, i) => `inv-${offset + i}`), EXPORT_ROW_CAP + 500);
    });
    const result = await fetchAllInvoicesForExport({}, fetchPage);
    expect(result.invoices).toHaveLength(EXPORT_ROW_CAP);
    expect(result.truncated).toBe(true);
  });
});
