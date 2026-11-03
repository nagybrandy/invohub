/** @jest-environment node */
const mockQ: { select: unknown[][]; insert: unknown[][] } = { select: [], insert: [] };
const mockCalls: { method: string; args: unknown[] }[] = [];

function mockChain(kind: "select" | "insert"): unknown {
  const proxy: unknown = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === "then") {
        const rows = mockQ[kind].shift() ?? [];
        return (resolve: (v: unknown) => void) => resolve(rows);
      }
      return (...args: unknown[]) => {
        mockCalls.push({ method: prop, args });
        return proxy;
      };
    },
  });
  return proxy;
}
jest.mock("@/db", () => ({ db: { select: () => mockChain("select"), insert: () => mockChain("insert") } }));

import { DIRECTORY_TTL_MS, isFresh, companyDirectory } from "@/lib/company/directory";

describe("isFresh", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("accepts a row fetched within the TTL", () => {
    expect(isFresh(new Date(now.getTime() - DIRECTORY_TTL_MS + 1000), now)).toBe(true);
  });
  it("rejects an older row", () => {
    expect(isFresh(new Date(now.getTime() - DIRECTORY_TTL_MS - 1000), now)).toBe(false);
  });
});

describe("companyDirectory", () => {
  beforeEach(() => {
    mockQ.select = [];
    mockQ.insert = [];
    mockCalls.length = 0;
  });

  it("returns null for a miss", async () => {
    mockQ.select = [[]];
    expect(await companyDirectory.get("12345678")).toBeNull();
  });

  it("maps a stored row to a lookup result with its freshness", async () => {
    const fetchedAt = new Date("2026-10-20T00:00:00Z");
    mockQ.select = [[{ taxNumberBase: "12345678", taxNumber: "12345678-2-41", name: "Duna Kft.", zipCode: "1051", city: "Budapest", address: "Október 6. utca 12.", country: "HU", fetchedAt }]];
    expect(await companyDirectory.get("12345678")).toEqual({
      result: { name: "Duna Kft.", taxNumber: "12345678-2-41", zipCode: "1051", city: "Budapest", address: "Október 6. utca 12.", country: "HU" },
      fetchedAt,
    });
  });

  it("upserts by törzsszám", async () => {
    await companyDirectory.save("12345678", { name: "Duna Kft.", taxNumber: "12345678-2-41", country: "HU", city: "Budapest" });
    const methods = mockCalls.map((c) => c.method);
    expect(methods).toEqual(expect.arrayContaining(["insert", "values", "onConflictDoUpdate"].filter((m) => m !== "insert")));
  });

  it("refuses to store a row without a name", async () => {
    await companyDirectory.save("12345678", { name: "", taxNumber: "12345678", country: "HU" });
    expect(mockCalls).toHaveLength(0);
  });
});
