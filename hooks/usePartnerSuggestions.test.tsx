import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { usePartnerSuggestions } from "@/hooks/usePartnerSuggestions";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api/client", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

type Hook = ReturnType<typeof usePartnerSuggestions>;
function mount(query: string, enabled = true) {
  const ref: { current: Hook | null } = { current: null };
  function Probe({ q, on }: { q: string; on: boolean }) {
    ref.current = usePartnerSuggestions(q, on);
    return null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Probe q={query} on={enabled} />);
  });
  return { ref, rerender: (q: string, on = true) => act(() => tree.update(<Probe q={q} on={on} />)) };
}
const s = (name: string) => ({ partner: { clientId: null, name }, invoiceCount: 1, lastIssueDate: "2026-10-01", usual: { lineItems: [] } });

beforeEach(() => {
  jest.useFakeTimers();
  mockApiFetch.mockReset();
});
afterEach(() => jest.useRealTimers());

it("loads the top few straight away for an empty query", async () => {
  mockApiFetch.mockResolvedValue({ suggestions: [s("A")] });
  const { ref } = mount("");
  await act(async () => {});
  expect(mockApiFetch).toHaveBeenCalledWith("/api/clients/suggestions?q=");
  expect(ref.current!.suggestions).toHaveLength(1);
});

it("debounces typing and encodes the query", async () => {
  mockApiFetch.mockResolvedValue({ suggestions: [] });
  const { rerender } = mount("");
  await act(async () => {});
  mockApiFetch.mockClear();
  rerender("ko");
  rerender("kovács");
  expect(mockApiFetch).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
  expect(mockApiFetch).toHaveBeenCalledTimes(1);
  expect(mockApiFetch.mock.calls[0][0]).toBe("/api/clients/suggestions?q=kov%C3%A1cs");
});

it("does nothing when disabled and swallows failures", async () => {
  mount("x", false);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockApiFetch).not.toHaveBeenCalled();
  mockApiFetch.mockRejectedValue(new Error("boom"));
  const { ref } = mount("");
  await act(async () => {});
  expect(ref.current!.suggestions).toEqual([]);
});
