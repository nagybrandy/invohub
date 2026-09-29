// hooks/useNavFailedCount.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useNavFailedCount } from "@/hooks/useNavFailedCount";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({ apiFetch: jest.fn() }));
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useNavFailedCount> | null } = { current: null };
  function HookHost() {
    ref.current = useNavFailedCount();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return ref;
}

describe("useNavFailedCount", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("asks the list API for the navFailed total only", async () => {
    mockApiFetch.mockResolvedValue({ total: 3 });
    const ref = await renderHook();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/invoices?navFailed=1&limit=1");
    expect(ref.current!.count).toBe(3);
    expect(ref.current!.loading).toBe(false);
  });

  it("falls back to zero on a failure rather than hiding the whole chip row", async () => {
    mockApiFetch.mockRejectedValue(new Error("down"));
    const ref = await renderHook();
    expect(ref.current!.count).toBe(0);
    expect(ref.current!.loading).toBe(false);
  });
});
