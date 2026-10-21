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

describe("lookupCompanyByTaxNumber (platform lookup account + directory cache)", () => {
  const platformCreds = { login: "dc", password: "p", signKey: "s", exchangeKey: "e", taxNumber: "99999999", environment: "production", source: "shared" } as const;
  const demoCompany = { id: "c1", userId: "u1", name: "X", navEnvironment: "demo", createdAt: "", updatedAt: "" } as Company;

  function makeDirectory(entry: { result: unknown; fetchedAt: Date } | null = null) {
    return { get: jest.fn().mockResolvedValue(entry), save: jest.fn().mockResolvedValue(undefined) };
  }
  const navAnswer = { valid: true, name: "Duna Kft.", city: "Budapest", zipCode: "1051", address: "Október 6. utca 12.", country: "HU", vatCode: "2", countyCode: "41" };

  beforeEach(() => jest.clearAllMocks());

  it("uses the platform account for a demo-mode company, returns the full 8-1-2 adószám and caches it", async () => {
    const queryTaxpayer = jest.fn().mockResolvedValue(navAnswer);
    mockGetNavClient.mockReturnValue({ queryTaxpayer });
    const directory = makeDirectory();

    const result = await lookupCompanyByTaxNumber("12345678", demoCompany, { directory, platformCredentials: () => platformCreds });

    expect(mockGetNavClient).toHaveBeenCalledWith("production");
    expect(queryTaxpayer).toHaveBeenCalledWith(platformCreds, "12345678");
    expect(result).toMatchObject({ name: "Duna Kft.", taxNumber: "12345678-2-41", city: "Budapest" });
    expect(directory.save).toHaveBeenCalledWith("12345678", expect.objectContaining({ name: "Duna Kft.", taxNumber: "12345678-2-41" }));
  });

  it("serves a fresh directory hit without calling NAV", async () => {
    const cached = { name: "Duna Kft.", taxNumber: "12345678-2-41", country: "HU" };
    const directory = makeDirectory({ result: cached, fetchedAt: new Date() });

    const result = await lookupCompanyByTaxNumber("12345678-2-41", demoCompany, { directory, platformCredentials: () => platformCreds });

    expect(result).toEqual(cached);
    expect(mockGetNavClient).not.toHaveBeenCalled();
  });

  it("re-queries NAV when the directory row is stale and refreshes it", async () => {
    const stale = { result: { name: "Régi Kft.", taxNumber: "12345678", country: "HU" }, fetchedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000) };
    const directory = makeDirectory(stale);
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockResolvedValue(navAnswer) });

    const result = await lookupCompanyByTaxNumber("12345678", demoCompany, { directory, platformCredentials: () => platformCreds });

    expect(result?.name).toBe("Duna Kft.");
    expect(directory.save).toHaveBeenCalled();
  });

  it("falls back to the stale directory row when NAV is down", async () => {
    const stale = { result: { name: "Régi Kft.", taxNumber: "12345678", country: "HU" }, fetchedAt: new Date(Date.now() - 90 * 24 * 3600 * 1000) };
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockRejectedValue(new Error("NAV HTTP 503")) });

    const result = await lookupCompanyByTaxNumber("12345678", demoCompany, { directory: makeDirectory(stale), platformCredentials: () => platformCreds });

    expect(result?.name).toBe("Régi Kft.");
  });

  it("never caches answers from the NAV test environment (fictional taxpayers)", async () => {
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockResolvedValue(navAnswer) });
    const directory = makeDirectory();

    await lookupCompanyByTaxNumber("12345678", demoCompany, {
      directory,
      platformCredentials: () => ({ ...platformCreds, environment: "test" }),
    });

    expect(directory.save).not.toHaveBeenCalled();
  });

  it("never caches an answer obtained through the company's own test-mode account", async () => {
    mockResolveNavCredentials.mockReturnValue({ login: "l", environment: "test" });
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockResolvedValue(navAnswer) });
    const directory = makeDirectory();

    await lookupCompanyByTaxNumber("12345678", { ...demoCompany, navEnvironment: "test" } as Company, { directory });

    expect(directory.save).not.toHaveBeenCalled();
  });

  it("does not cache or return an invalid taxpayer", async () => {
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockResolvedValue({ valid: false }) });
    const directory = makeDirectory();

    const result = await lookupCompanyByTaxNumber("12345678", demoCompany, { directory, platformCredentials: () => platformCreds });

    expect(result).toBeNull();
    expect(directory.save).not.toHaveBeenCalled();
  });

  it("keeps invoicing alive when the directory itself is broken", async () => {
    const directory = { get: jest.fn().mockRejectedValue(new Error("db down")), save: jest.fn().mockRejectedValue(new Error("db down")) };
    mockGetNavClient.mockReturnValue({ queryTaxpayer: jest.fn().mockResolvedValue(navAnswer) });

    const result = await lookupCompanyByTaxNumber("12345678", demoCompany, { directory, platformCredentials: () => platformCreds });

    expect(result?.name).toBe("Duna Kft.");
  });

  it("without a platform account a demo-mode company still gets the demo lookup", async () => {
    const result = await lookupCompanyByTaxNumber("12345678-1-23", demoCompany, { platformCredentials: () => null });
    expect(result?.name).toBe("Demo Kft.");
    expect(mockGetNavClient).not.toHaveBeenCalled();
  });
});
