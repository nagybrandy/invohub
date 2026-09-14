// lib/company/lookup.test.ts
const mockGetNavClient = jest.fn();
jest.mock("@/lib/nav/client", () => ({
  getNavClient: (...args: unknown[]) => mockGetNavClient(...args),
}));

const mockResolveNavCredentials = jest.fn();
jest.mock("@/lib/nav/resolve-credentials", () => ({
  resolveNavCredentials: (...args: unknown[]) => mockResolveNavCredentials(...args),
  NavCredentialsMissingError: class MockNavCredentialsMissingError extends Error {},
}));

import { lookupCompanyByTaxNumber } from "@/lib/company/lookup";
import { NavCredentialsMissingError } from "@/lib/nav/resolve-credentials";
import type { Company } from "@/lib/companies/service";

describe("lookupCompanyByTaxNumber", () => {
  it("returns null for empty input", async () => {
    expect(await lookupCompanyByTaxNumber("")).toBeNull();
    expect(await lookupCompanyByTaxNumber("   ")).toBeNull();
  });

  it("returns mock company for known tax number", async () => {
    const result = await lookupCompanyByTaxNumber("12345678-1-23");
    expect(result).toMatchObject({
      name: "Demo Kft.",
      taxNumber: "12345678-1-23",
      country: "HU",
    });
  });

  it("trims whitespace before lookup", async () => {
    const result = await lookupCompanyByTaxNumber("  98765432-2-43  ");
    expect(result?.name).toBe("Sample Zrt.");
  });

  it("returns partial stub for valid HU format unknown number", async () => {
    const result = await lookupCompanyByTaxNumber("11111111-1-11");
    expect(result).toEqual({
      name: "",
      taxNumber: "11111111-1-11",
      country: "HU",
    });
  });

  it("returns null for invalid format", async () => {
    expect(await lookupCompanyByTaxNumber("invalid")).toBeNull();
  });

  it("defaults to demo lookup when no company is passed", async () => {
    const result = await lookupCompanyByTaxNumber("12345678-1-23");
    expect(result?.name).toBe("Demo Kft.");
    expect(mockGetNavClient).not.toHaveBeenCalled();
  });
});

describe("lookupCompanyByTaxNumber (test/production mode)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const testModeCompany: Company = {
    id: "c1",
    userId: "u1",
    name: "Demo Kft.",
    navEnvironment: "test",
    createdAt: "",
    updatedAt: "",
  };

  it("calls the real NAV queryTaxpayer client when the company is in test mode", async () => {
    const fakeCredentials = { login: "l", taxNumber: "12345678" };
    mockResolveNavCredentials.mockReturnValue(fakeCredentials);
    const queryTaxpayer = jest.fn().mockResolvedValue({
      valid: true,
      name: "Valódi Kft.",
      city: "Debrecen",
      zipCode: "4024",
      address: "Piac utca 1.",
      country: "HU",
    });
    mockGetNavClient.mockReturnValue({ queryTaxpayer });

    const result = await lookupCompanyByTaxNumber("12345678-1-23", testModeCompany);

    expect(mockGetNavClient).toHaveBeenCalledWith("test");
    expect(queryTaxpayer).toHaveBeenCalledWith(fakeCredentials, "12345678");
    expect(result).toMatchObject({ name: "Valódi Kft.", city: "Debrecen" });
  });

  it("returns null when NAV reports the taxpayer as invalid", async () => {
    mockResolveNavCredentials.mockReturnValue({ login: "l" });
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockResolvedValue({ valid: false }) });

    const result = await lookupCompanyByTaxNumber("11111111-1-11", testModeCompany);
    expect(result).toBeNull();
  });

  it("falls back to the demo lookup when real credentials aren't configured yet", async () => {
    mockResolveNavCredentials.mockImplementation(() => {
      throw new NavCredentialsMissingError("missing creds");
    });

    const result = await lookupCompanyByTaxNumber("12345678-1-23", testModeCompany);
    expect(result?.name).toBe("Demo Kft.");
  });
});
