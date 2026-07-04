// hooks/usePdfTemplate.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { usePdfTemplate } from "@/hooks/usePdfTemplate";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
  getAuthBaseUrl: () => "http://localhost:8081",
}));

jest.mock("@/lib/auth-url", () => ({
  getAuthBaseUrl: () => "http://localhost:8081",
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof usePdfTemplate> | null } = { current: null };
  function Host() {
    ref.current = usePdfTemplate();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<Host />);
    await Promise.resolve();
  });
  return ref;
}

describe("usePdfTemplate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({
      template: {
        titleText: "INVOICE",
        accentColor: "#4f46e5",
        showCompanyBlock: true,
        showBankDetails: true,
        showClientTaxNumber: true,
        footerText: "",
        notesLabel: "Notes",
        fontScale: "medium",
      },
    });
  });

  it("loads template on mount", async () => {
    const ref = await renderHook();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.template?.titleText).toBe("INVOICE");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/pdf-template");
  });
});
