import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useWorkspaces, type UseWorkspaces } from "@/hooks/useWorkspaces";

const mockApiFetch = jest.fn();
const mockSetActive = jest.fn();
let mockActiveId: string | null = null;
jest.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
jest.mock("@/lib/workspaces/active-client", () => ({
  getActiveAccountId: () => mockActiveId,
  setActiveAccountId: (id: string | null) => mockSetActive(id),
}));

const ACCOUNTS = [
  { id: "p1", name: "Anna", kind: "person", role: "owner", isOwn: true },
  { id: "ws-aaaaaa", name: "Ügyfél Kft.", kind: "workspace", role: "viewer", isOwn: false },
];

function mount() {
  const ref: { current: UseWorkspaces | null } = { current: null };
  function Probe() {
    ref.current = useWorkspaces();
    return null;
  }
  act(() => {
    TestRenderer.create(<Probe />);
  });
  return ref;
}

describe("useWorkspaces", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockSetActive.mockReset();
    mockActiveId = null;
  });

  it("loads the accounts and exposes the active one, its role and whether it is foreign", async () => {
    mockApiFetch.mockResolvedValue({ accounts: ACCOUNTS, activeId: "ws-aaaaaa" });
    const ref = mount();
    await act(async () => {});
    expect(ref.current!.active?.name).toBe("Ügyfél Kft.");
    expect(ref.current!.role).toBe("viewer");
    expect(ref.current!.inForeignAccount).toBe(true);
    expect(ref.current!.loading).toBe(false);
  });

  it("is in the own account (owner) by default", async () => {
    mockApiFetch.mockResolvedValue({ accounts: ACCOUNTS, activeId: "p1" });
    const ref = mount();
    await act(async () => {});
    expect(ref.current!.inForeignAccount).toBe(false);
    expect(ref.current!.role).toBe("owner");
  });

  it("forgets a stored selection the server no longer allows (revoked access)", async () => {
    mockActiveId = "gone-account-1";
    mockApiFetch.mockResolvedValue({ accounts: ACCOUNTS, activeId: "p1" });
    mount();
    await act(async () => {});
    expect(mockSetActive).toHaveBeenCalledWith(null);
  });

  it("keeps working (no accounts) when the request fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("offline"));
    const ref = mount();
    await act(async () => {});
    expect(ref.current!.accounts).toEqual([]);
    expect(ref.current!.active).toBeNull();
    expect(ref.current!.loading).toBe(false);
  });

  it("creates a workspace and refreshes the list", async () => {
    mockApiFetch.mockResolvedValueOnce({ accounts: ACCOUNTS, activeId: "p1" });
    const ref = mount();
    await act(async () => {});
    mockApiFetch.mockResolvedValueOnce({ workspace: { id: "ws-new-111", name: "Új Kft." } }).mockResolvedValueOnce({ accounts: ACCOUNTS, activeId: "p1" });
    let created;
    await act(async () => {
      created = await ref.current!.create("Új Kft.");
    });
    expect(created).toEqual({ id: "ws-new-111", name: "Új Kft." });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/workspaces", expect.objectContaining({ method: "POST" }));
  });
});
