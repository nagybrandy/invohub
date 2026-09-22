// lib/clients/party-type.test.ts
import { normalizeClientPartyType } from "@/lib/clients/party-type";

describe("normalizeClientPartyType", () => {
  it("accepts the two known values", () => {
    expect(normalizeClientPartyType("company")).toBe("company");
    expect(normalizeClientPartyType("private_person")).toBe("private_person");
  });

  it("maps anything else (including null/undefined/garbage) to null — never persists raw input", () => {
    expect(normalizeClientPartyType(undefined)).toBeNull();
    expect(normalizeClientPartyType(null)).toBeNull();
    expect(normalizeClientPartyType("")).toBeNull();
    expect(normalizeClientPartyType("PRIVATE_PERSON")).toBeNull();
    expect(normalizeClientPartyType(42)).toBeNull();
  });
});
