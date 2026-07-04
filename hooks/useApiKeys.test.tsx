// hooks/useApiKeys.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useApiKeys } from "@/hooks/useApiKeys";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useApiKeys> | null } = { current: null };

  function HookHost() {
    ref.current = useApiKeys();
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });

  return ref;
}

describe("useApiKeys", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ keys: [] });
  });

  it("loads keys on mount", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/api-keys");
    expect(ref.current?.loading).toBe(false);
  });
});
