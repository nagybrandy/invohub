// hooks/useMissingExchangeRateCount.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useMissingExchangeRateCount } from "@/hooks/useMissingExchangeRateCount";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useMissingExchangeRateCount> | null } = {
    current: null,
  };
  function HookHost() {
    ref.current = useMissingExchangeRateCount();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return ref;
}

describe("useMissingExchangeRateCount", () => {
  it("fetches the affected-only total from the list API", async () => {
    mockApiFetch.mockResolvedValue({ total: 3 });

    const ref = await renderHook();

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/invoices?needsExchangeRate=1&limit=1"
    );
    expect(ref.current?.count).toBe(3);
    expect(ref.current?.loading).toBe(false);
  });

  it("returns 0 when the request rejects", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    const ref = await renderHook();

    expect(ref.current?.count).toBe(0);
    expect(ref.current?.loading).toBe(false);
  });
});
