// hooks/useReceipts.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useReceipts } from "@/hooks/useReceipts";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderUseReceipts() {
  const ref: { current: ReturnType<typeof useReceipts> | null } = {
    current: null,
  };

  function HookHost() {
    ref.current = useReceipts();
    return null;
  }

  await act(async () => {
    TestRenderer.create(<HookHost />);
    await Promise.resolve();
  });

  return ref;
}

const sampleReceipt = {
  id: "r1",
  userId: "u1",
  receiptNumber: "NYG-2026-001",
  totalAmount: 5000,
  currency: "HUF",
  paymentMethod: "cash",
  qrToken: "token-1",
  qrUrl: "http://localhost/receipts/view?token=token-1",
  navSubmitted: false,
  lineItems: [],
  issuedAt: "2026-08-01T10:00:00.000Z",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

describe("useReceipts", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ receipts: [sampleReceipt] });
  });

  it("loads receipts on mount", async () => {
    const ref = await renderUseReceipts();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.receipts).toHaveLength(1);
    expect(ref.current?.receipts[0].receiptNumber).toBe("NYG-2026-001");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/receipts");
  });

  it("handles API errors", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const ref = await renderUseReceipts();
    await act(async () => {
      await Promise.resolve();
    });
    expect(ref.current?.loading).toBe(false);
    expect(ref.current?.error).toBe("Network error");
    expect(ref.current?.receipts).toHaveLength(0);
  });

  it("refreshes receipts", async () => {
    const ref = await renderUseReceipts();
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(1);

    mockApiFetch.mockResolvedValue({
      receipts: [sampleReceipt, { ...sampleReceipt, id: "r2", receiptNumber: "NYG-2026-002" }],
    });
    await act(async () => {
      await ref.current?.refresh();
    });
    expect(ref.current?.receipts).toHaveLength(2);
  });
});
