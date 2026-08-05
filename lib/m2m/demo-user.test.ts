// lib/m2m/demo-user.test.ts
import { fetchM2mDemoSnapshot } from "@/lib/m2m/demo-user";

jest.mock("@/lib/m2m/credentials", () => ({
  loadM2mCredentialsFromEnv: jest.fn(() => ({
    clientId: "c",
    clientSecret: "s",
    username: "u",
    password: "p",
    signatureKeyFirst: "first",
    nonce: "nonce",
    environment: "test",
  })),
}));

jest.mock("@/lib/m2m/auth", () => ({
  createM2mSession: jest.fn().mockResolvedValue({
    accessToken: "token",
    signingKey: "full-key",
  }),
}));

jest.mock("@/lib/m2m/adozo", () => ({
  fetchM2mTaxSummary: jest.fn().mockResolvedValue({
    ok: true,
    resultCode: "SIKERES",
    data: { totalBalance: -1000, taxDebt: 100, overpayment: -1100 },
  }),
  fetchM2mMissingDeclarations: jest.fn().mockResolvedValue({
    ok: true,
    resultCode: "SIKERES",
    data: [{ title: "VAT", type: "2265", period: "221", dueDate: "2022-04-20" }],
  }),
  fetchM2mPublicDebt: jest.fn().mockResolvedValue({
    ok: false,
    resultCode: "NINCS_ADAT",
    data: null,
  }),
  fetchM2mDetailedTaxpayer: jest.fn().mockResolvedValue({
    ok: true,
    resultCode: "SIKERES",
    data: {
      name: "Test Kft.",
      taxNumber: "8495512912",
      address: "Budapest",
      period: "2025",
    },
  }),
}));

describe("fetchM2mDemoSnapshot", () => {
  it("returns snapshot for a fixed test taxpayer", async () => {
    const snapshot = await fetchM2mDemoSnapshot({ taxpayerId: "8495512912" });

    expect(snapshot.taxpayer.id).toBe("8495512912");
    expect(snapshot.taxSummary?.totalBalance).toBe(-1000);
    expect(snapshot.missingDeclarations).toHaveLength(1);
    expect(snapshot.detailedTaxpayer?.name).toBe("Test Kft.");
    expect(snapshot.checks.some((c) => c.name === "Token + signing key" && c.ok)).toBe(true);
    expect(snapshot.allEndpointsReachable).toBe(true);
  });
});
