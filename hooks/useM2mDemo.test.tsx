// hooks/useM2mDemo.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useM2mDemo } from "@/hooks/useM2mDemo";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const demoSnapshot = {
  taxpayer: { id: "12345678", label: "Demo taxpayer" },
  environment: "demo" as const,
  checks: [{ name: "Token", ok: true, resultCode: "OK", message: null }],
  taxSummary: { totalBalance: 100, taxDebt: 0, overpayment: 100 },
  missingDeclarations: [],
  publicDebt: null,
  detailedTaxpayer: null,
  allEndpointsReachable: true,
};

async function renderHook() {
  const ref: { current: ReturnType<typeof useM2mDemo> | null } = { current: null };
  function HookHost() {
    ref.current = useM2mDemo();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });
  return ref;
}

describe("useM2mDemo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the demo snapshot and reports mode=demo", async () => {
    mockApiFetch.mockResolvedValue({ snapshot: demoSnapshot, configured: false, mode: "demo" });
    const ref = await renderHook();

    await act(async () => {
      await ref.current?.load();
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/m2m/demo");
    expect(ref.current?.snapshot?.taxpayer.id).toBe("12345678");
    expect(ref.current?.mode).toBe("demo");
    expect(ref.current?.error).toBeNull();
  });

  it("reports mode=test when the server used the real M2M registry", async () => {
    mockApiFetch.mockResolvedValue({
      snapshot: { ...demoSnapshot, environment: "test" },
      configured: true,
      mode: "test",
    });
    const ref = await renderHook();

    await act(async () => {
      await ref.current?.load();
    });

    expect(ref.current?.mode).toBe("test");
  });

  it("passes seed as a query param", async () => {
    mockApiFetch.mockResolvedValue({ snapshot: demoSnapshot, mode: "demo" });
    const ref = await renderHook();

    await act(async () => {
      await ref.current?.load(42);
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/m2m/demo?seed=42");
  });

  it("surfaces a server error and clears the snapshot", async () => {
    mockApiFetch.mockResolvedValue({ error: "boom" });
    const ref = await renderHook();

    await act(async () => {
      await ref.current?.load();
    });

    expect(ref.current?.error).toBe("boom");
    expect(ref.current?.snapshot).toBeNull();
  });
});
