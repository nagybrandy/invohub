import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useRecurringInvoices } from "@/hooks/useRecurringInvoices";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

function mount() {
  const ref: { current: ReturnType<typeof useRecurringInvoices> | null } = { current: null };
  function Probe() {
    ref.current = useRecurringInvoices();
    return null;
  }
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return ref;
}

describe("useRecurringInvoices", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("loads the templates", async () => {
    mockApiFetch.mockResolvedValue({ templates: [{ id: "t1" }] });
    const ref = mount();
    await act(async () => {});
    expect(mockApiFetch).toHaveBeenCalledWith("/api/recurring-invoices");
    expect(ref.current!.templates).toEqual([{ id: "t1" }]);
    expect(ref.current!.loading).toBe(false);
  });

  it("reports a load failure", async () => {
    mockApiFetch.mockRejectedValue(new Error("offline"));
    const ref = mount();
    await act(async () => {});
    expect(ref.current!.error).toBe("offline");
    expect(ref.current!.templates).toEqual([]);
  });

  it("creates from an invoice with a POST", async () => {
    mockApiFetch.mockResolvedValueOnce({ templates: [] }).mockResolvedValueOnce({ template: { id: "new" } });
    const ref = mount();
    await act(async () => {});
    let created;
    await act(async () => {
      created = await ref.current!.create({ sourceInvoiceId: "inv-1", frequency: "monthly", startDate: "2027-01-31" });
    });
    expect(created).toEqual({ id: "new" });
    expect(mockApiFetch).toHaveBeenLastCalledWith(
      "/api/recurring-invoices",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ sourceInvoiceId: "inv-1", frequency: "monthly", startDate: "2027-01-31" }) })
    );
  });

  it("pauses with a PATCH then refreshes; deletes with a DELETE then refreshes", async () => {
    mockApiFetch.mockResolvedValue({ templates: [], template: { id: "t1" } });
    const ref = mount();
    await act(async () => {});
    mockApiFetch.mockClear();
    await act(async () => {
      await ref.current!.update("t1", { status: "paused" });
    });
    expect(mockApiFetch).toHaveBeenNthCalledWith(1, "/api/recurring-invoices/t1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "paused" }) }));
    expect(mockApiFetch).toHaveBeenNthCalledWith(2, "/api/recurring-invoices");
    mockApiFetch.mockClear();
    await act(async () => {
      await ref.current!.remove("t1");
    });
    expect(mockApiFetch).toHaveBeenNthCalledWith(1, "/api/recurring-invoices/t1", { method: "DELETE" });
  });
});
