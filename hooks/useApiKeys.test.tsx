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

  it("creates a key and refreshes the list", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ keys: [] })
      .mockResolvedValueOnce({
        key: {
          id: "key-1",
          publicKey: "pk_test",
          secretKey: "sk_test",
          name: "ERP",
          userId: "u1",
          enabled: true,
          lastUsedAt: null,
          createdAt: "",
          updatedAt: "",
        },
      })
      .mockResolvedValueOnce({ keys: [{ id: "key-1", publicKey: "pk_test", name: "ERP" }] });

    const ref = await renderHook();
    await act(async () => {
      await ref.current?.create("ERP");
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "ERP" }),
    });
    expect(ref.current?.keys).toHaveLength(1);
  });

  it("revokes a key and refreshes the list", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ keys: [{ id: "key-1", publicKey: "pk_test", name: "ERP" }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ keys: [] });

    const ref = await renderHook();
    await act(async () => {
      await ref.current?.revoke("key-1");
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/api-keys/key-1", { method: "DELETE" });
    expect(ref.current?.keys).toHaveLength(0);
  });
});
