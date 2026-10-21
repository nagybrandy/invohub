import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useCompanySearch } from "@/hooks/useCompanySearch";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

type Hook = ReturnType<typeof useCompanySearch>;

function mount(query: string, enabled = true) {
  const ref: { current: Hook | null } = { current: null };
  function Probe({ q, on }: { q: string; on: boolean }) {
    ref.current = useCompanySearch(q, on);
    return null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Probe q={query} on={enabled} />);
  });
  return { ref, tree, rerender: (q: string, on = true) => act(() => tree.update(<Probe q={q} on={on} />)) };
}

describe("useCompanySearch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockApiFetch.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it("waits for the typing to settle, then searches once", async () => {
    mockApiFetch.mockResolvedValue({ results: [{ name: "Tech Kft.", source: "nav" }], provider: "nav-only" });
    const { ref, rerender } = mount("tec");
    rerender("tech");
    rerender("tech k");
    expect(mockApiFetch).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch.mock.calls[0][0]).toBe("/api/company/search?q=tech%20k");
    expect(ref.current!.results).toHaveLength(1);
  });

  it("does not search for short queries or when disabled", async () => {
    mount("te");
    mount("telekom", false);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("turns a failed search into no results", async () => {
    mockApiFetch.mockRejectedValue(new Error("boom"));
    const { ref } = mount("telekom");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(ref.current!.results).toEqual([]);
    expect(ref.current!.loading).toBe(false);
  });
});
