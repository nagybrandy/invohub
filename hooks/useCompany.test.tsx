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
});
