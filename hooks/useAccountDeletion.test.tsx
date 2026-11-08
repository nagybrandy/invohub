import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { apiFetch } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({ apiFetch: jest.fn() }));
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

async function renderHook() {
  const ref: { current: ReturnType<typeof useAccountDeletion> | null } = { current: null };
  function Host() {
    ref.current = useAccountDeletion();
    return null;
  }
  await act(async () => {
    TestRenderer.create(<Host />);
    await Promise.resolve();
  });
  return ref;
}

describe("useAccountDeletion", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("loads the open request", async () => {
    const r = { id: "r1", status: "requested", requestedAt: "2026-11-08", scheduledFor: "2026-12-08" };
    mockApiFetch.mockResolvedValueOnce({ request: r });
    const ref = await renderHook();
    expect(mockApiFetch).toHaveBeenCalledWith("/api/account/deletion");
    expect(ref.current?.request).toEqual(r);
  });

  it("ignores cancelled / completed requests", async () => {
    mockApiFetch.mockResolvedValueOnce({ request: { id: "r1", status: "cancelled" } });
    expect((await renderHook()).current?.request).toBeNull();
  });

  it("surfaces an error (e.g. the 404 while the flag is off)", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Not found"));
    expect((await renderHook()).current?.error).toBe("Not found");
  });

  it("request posts an explicit confirmation, then refreshes", async () => {
    mockApiFetch.mockResolvedValueOnce({ request: null }).mockResolvedValueOnce({}).mockResolvedValueOnce({ request: null });
    const ref = await renderHook();
    await act(async () => {
      await ref.current!.requestDeletion(" moving ");
    });
    expect(mockApiFetch).toHaveBeenNthCalledWith(2, "/api/account/deletion", {
      method: "POST",
      body: JSON.stringify({ confirm: true, reason: "moving" }),
    });
  });

  it("cancel sends DELETE", async () => {
    mockApiFetch.mockResolvedValue({ request: null });
    const ref = await renderHook();
    await act(async () => {
      await ref.current!.cancelRequest();
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/account/deletion", { method: "DELETE" });
  });
});
