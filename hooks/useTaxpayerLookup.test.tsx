// hooks/useTaxpayerLookup.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useTaxpayerLookup } from "@/hooks/useTaxpayerLookup";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({ apiFetch: jest.fn() }));
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useTaxpayerLookup> | null } = { current: null };
  function HookHost() {
    ref.current = useTaxpayerLookup();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });
  return ref;
}

describe("useTaxpayerLookup", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("asks the lookup route for the trimmed, encoded tax number and returns the taxpayer", async () => {
    mockApiFetch.mockResolvedValue({ company: { name: "Minta Kft.", city: "Budapest", zipCode: "1011", address: "Fő u. 1." } });
    const ref = await renderHook();
    let result;
    await act(async () => { result = await ref.current!.lookup("  12345678-1-42 "); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/company/lookup?taxNumber=12345678-1-42");
    expect(result).toEqual({ name: "Minta Kft.", city: "Budapest", zipCode: "1011", address: "Fő u. 1." });
    expect(ref.current!.error).toBeNull();
  });

  it("treats the route's empty shell for an unknown number as a miss", async () => {
    mockApiFetch.mockResolvedValue({ company: { name: "", taxNumber: "12345678-1-42", country: "HU" } });
    const ref = await renderHook();
    let result;
    await act(async () => { result = await ref.current!.lookup("12345678-1-42"); });
    expect(result).toBeNull();
    expect(ref.current!.error).toBeNull();
  });

  it("does not call the API for an empty number", async () => {
    const ref = await renderHook();
    let result;
    await act(async () => { result = await ref.current!.lookup("   "); });
    expect(result).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("surfaces a failure as error and resolves null instead of throwing into the form", async () => {
    mockApiFetch.mockRejectedValue(new Error("NAV unavailable"));
    const ref = await renderHook();
    let result;
    await act(async () => { result = await ref.current!.lookup("12345678-1-42"); });
    expect(result).toBeNull();
    expect(ref.current!.error).toBe("NAV unavailable");
    expect(ref.current!.loading).toBe(false);
  });
});
