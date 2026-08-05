// hooks/useCompany.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useCompany } from "@/hooks/useCompany";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useCompany> | null } = { current: null };

  function HookHost() {
    ref.current = useCompany();
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });

  return ref;
}

describe("useCompany", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({
      company: {
        id: "c1",
        userId: "u1",
        name: "Demo Kft.",
        navTechnicalUser: "nav-user",
        createdAt: "",
        updatedAt: "",
      },
    });
  });

  it("loads company on mount", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.company?.name).toBe("Demo Kft.");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/companies");
  });

  it("save posts company payload", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });

    mockApiFetch.mockResolvedValueOnce({
      company: { id: "c1", userId: "u1", name: "Updated", createdAt: "", updatedAt: "" },
    });

    await act(async () => {
      await ref.current?.save({ name: "Updated", navTechnicalUser: "new-user" });
    });

    expect(mockApiFetch).toHaveBeenLastCalledWith("/api/companies", {
      method: "POST",
      body: JSON.stringify({ name: "Updated", navTechnicalUser: "new-user" }),
    });
  });

  it("save with NAV credential fields", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });

    const navPayload = {
      name: "Nav Kft.",
      navTechnicalUser: "tech-user",
      navTechnicalPassword: "tech-pass",
      navXmlSignKey: "xml-key",
      taxNumber: "99887766-2-41",
    };

    mockApiFetch.mockResolvedValueOnce({
      company: { id: "c1", userId: "u1", ...navPayload, createdAt: "", updatedAt: "" },
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current?.save(navPayload);
    });

    expect(mockApiFetch).toHaveBeenLastCalledWith("/api/companies", {
      method: "POST",
      body: JSON.stringify(navPayload),
    });
    expect((result as any).name).toBe("Nav Kft.");
    expect(ref.current?.company?.navTechnicalUser).toBe("tech-user");
  });

  it("lookup calls the lookup endpoint", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });

    mockApiFetch.mockResolvedValueOnce({
      company: { name: "Found Kft.", taxNumber: "12345678-2-41" },
    });

    let result: unknown;
    await act(async () => {
      result = await ref.current?.lookup("12345678-2-41");
    });

    expect(mockApiFetch).toHaveBeenLastCalledWith(
      "/api/company/lookup?taxNumber=12345678-2-41"
    );
    expect((result as any).company.name).toBe("Found Kft.");
  });

  it("lookup returns null company when not found", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });

    mockApiFetch.mockResolvedValueOnce({ company: null });

    let result: unknown;
    await act(async () => {
      result = await ref.current?.lookup("00000000-0-00");
    });

    expect((result as any).company).toBeNull();
  });

  it("handles load error gracefully", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));

    const ref: { current: ReturnType<typeof useCompany> | null } = { current: null };

    function HookHost() {
      ref.current = useCompany();
      return null;
    }

    await act(async () => {
      TestRenderer.create(<HookHost />);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(ref.current?.error).toBe("Network error");
    expect(ref.current?.company).toBeNull();
  });
});
