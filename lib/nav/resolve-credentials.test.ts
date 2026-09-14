// lib/nav/resolve-credentials.test.ts
import {
  NavCredentialsMissingError,
  hasOwnNavCredentials,
  isSharedNavTestAccountConfigured,
  resolveNavCredentials,
} from "@/lib/nav/resolve-credentials";
import type { Company } from "@/lib/companies/service";

const ENV_KEYS = [
  "NAV_TEST_LOGIN",
  "NAV_TEST_PASSWORD",
  "NAV_TEST_SIGN_KEY",
  "NAV_TEST_CHANGE_KEY",
  "NAV_TEST_TAX_NUMBER",
  "NAV_PRODUCTION_ENABLED",
] as const;

function baseCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "c1",
    userId: "u1",
    name: "Demo Kft.",
    taxNumber: "12345678-1-23",
    createdAt: "",
    updatedAt: "",
    navEnvironment: "test",
    ...overrides,
  };
}

describe("resolveNavCredentials", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("throws for demo mode (callers should never call this for demo)", () => {
    expect(() => resolveNavCredentials(baseCompany({ navEnvironment: "demo" }))).toThrow(
      NavCredentialsMissingError
    );
  });

  it("uses the company's own credentials when fully configured", () => {
    const company = baseCompany({
      navTechnicalUser: "own-login",
      navTechnicalPassword: "own-pass",
      navXmlSignKey: "own-sign",
      navXmlChangeKey: "1234567890ABCDEF",
    });
    expect(hasOwnNavCredentials(company)).toBe(true);

    const creds = resolveNavCredentials(company);
    expect(creds).toMatchObject({
      login: "own-login",
      password: "own-pass",
      signKey: "own-sign",
      exchangeKey: "1234567890ABCDEF",
      taxNumber: "12345678",
      environment: "test",
      source: "own",
    });
  });

  it("falls back to the shared test account when own creds are incomplete", () => {
    process.env.NAV_TEST_LOGIN = "shared-login";
    process.env.NAV_TEST_PASSWORD = "shared-pass";
    process.env.NAV_TEST_SIGN_KEY = "shared-sign";
    process.env.NAV_TEST_CHANGE_KEY = "SHAREDCHANGEKEY1";
    process.env.NAV_TEST_TAX_NUMBER = "98765432-1-23";

    expect(isSharedNavTestAccountConfigured()).toBe(true);

    const creds = resolveNavCredentials(baseCompany());
    expect(creds).toMatchObject({
      login: "shared-login",
      taxNumber: "98765432",
      source: "shared",
      environment: "test",
    });
  });

  it("throws a clear error when neither own nor shared test creds exist", () => {
    expect(() => resolveNavCredentials(baseCompany())).toThrow(NavCredentialsMissingError);
  });

  it("refuses production unless NAV_PRODUCTION_ENABLED=true, even with own creds", () => {
    const company = baseCompany({
      navEnvironment: "production",
      navTechnicalUser: "own-login",
      navTechnicalPassword: "own-pass",
      navXmlSignKey: "own-sign",
      navXmlChangeKey: "1234567890ABCDEF",
    });
    expect(() => resolveNavCredentials(company)).toThrow(NavCredentialsMissingError);

    process.env.NAV_PRODUCTION_ENABLED = "true";
    const creds = resolveNavCredentials(company);
    expect(creds.environment).toBe("production");
    expect(creds.source).toBe("own");
  });

  it("never falls back to the shared test account for production", () => {
    process.env.NAV_PRODUCTION_ENABLED = "true";
    process.env.NAV_TEST_LOGIN = "shared-login";
    process.env.NAV_TEST_PASSWORD = "shared-pass";
    process.env.NAV_TEST_SIGN_KEY = "shared-sign";
    process.env.NAV_TEST_CHANGE_KEY = "SHAREDCHANGEKEY1";
    process.env.NAV_TEST_TAX_NUMBER = "98765432-1-23";

    const company = baseCompany({ navEnvironment: "production" });
    expect(() => resolveNavCredentials(company)).toThrow(NavCredentialsMissingError);
  });
});
