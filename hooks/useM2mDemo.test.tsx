// hooks/useM2mDemo.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useM2mDemo } from "@/hooks/useM2mDemo";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

const sampleSnapshot = {
  taxpayer: { id: "88888888", label: "Test taxpayer #88888888" },
  environment: "test" as const,
  checks: [
    { name: "Token + signing key", ok: true, resultCode: "OK", message: "Session created" },
    { name: "Összesített adószámla", ok: true, resultCode: "SIKERES" },
  ],
  taxSummary: { totalBalance: -15000, taxDebt: 15000, overpayment: 0 },
  missingDeclarations: [],
  publicDebt: null,
  detailedTaxpayer: { name: "Test Corp", taxNumber: "88888888", address: "Test St 1", period: "2025" },
  allEndpointsReachable: true,
};

async function renderUseM2mDemo() {
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

  it("starts with no snapshot and not loading", async () => {
    mockApiFetch.mockResolvedValue({ snapshot: sampleSnapshot, configured: true });
    const ref = await renderUseM2mDemo();

    expect(ref.current?.snapshot).toBeNull();
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.error).toBeNull();
    expect(ref.current?.notConfigured).toBe(false);
  });

  it("loads snapshot via load()", async () => {
    mockApiFetch.mockResolvedValue({ snapshot: sampleSnapshot, configured: true });
    const ref = await renderUseM2mDemo();

    await act(async () => {
      await ref.current?.load();
    });

    expect(ref.current?.snapshot).toEqual(sampleSnapshot);
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.error).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/m2m/demo");
  });

  it("passes seed parameter", async () => {
    mockApiFetch.mockResolvedValue({ snapshot: sampleSnapshot, configured: true });
    const ref = await renderUseM2mDemo();

    await act(async () => {
      await ref.current?.load(12345);
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/m2m/demo?seed=12345");
  });

  it("handles not configured state", async () => {
    mockApiFetch.mockResolvedValue({
      error: "M2M not configured.",
      hint: "Add M2M_* variables to .env",
    });
    const ref = await renderUseM2mDemo();

    await act(async () => {
      await ref.current?.load();
    });

    expect(ref.current?.notConfigured).toBe(true);
    expect(ref.current?.error).toBe("M2M not configured.");
    expect(ref.current?.snapshot).toBeNull();
  });

  it("handles API errors", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const ref = await renderUseM2mDemo();

    await act(async () => {
      await ref.current?.load();
    });

    expect(ref.current?.error).toBe("Network error");
    expect(ref.current?.snapshot).toBeNull();
    expect(ref.current?.loading).toBe(false);
  });

  it("handles server error response", async () => {
    mockApiFetch.mockResolvedValue({ error: "M2M demo failed." });
    const ref = await renderUseM2mDemo();

    await act(async () => {
      await ref.current?.load();
    });

    expect(ref.current?.error).toBe("M2M demo failed.");
    expect(ref.current?.notConfigured).toBe(false);
    expect(ref.current?.snapshot).toBeNull();
  });
});
