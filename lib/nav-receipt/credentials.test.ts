// lib/nav-receipt/credentials.test.ts
import {
  isNavReceiptConfigured,
  loadNavReceiptCredentials,
  loadNavReceiptCredentialsFromCompany,
} from "@/lib/nav-receipt/credentials";

describe("loadNavReceiptCredentials", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("throws when required vars are missing", () => {
    delete process.env.NAV_RECEIPT_TECH_USER;
    delete process.env.NAV_RECEIPT_TECH_PASS;
    delete process.env.NAV_RECEIPT_SIGN_KEY;
    delete process.env.NAV_RECEIPT_TAX_NUMBER;
    expect(() => loadNavReceiptCredentials()).toThrow("NAV receipt credentials not configured");
  });

  it("loads credentials when all vars are set", () => {
    process.env.NAV_RECEIPT_TECH_USER = "user1";
    process.env.NAV_RECEIPT_TECH_PASS = "pass1";
    process.env.NAV_RECEIPT_SIGN_KEY = "key1";
    process.env.NAV_RECEIPT_TAX_NUMBER = "12345678";

    const creds = loadNavReceiptCredentials();
    expect(creds.technicalUser).toBe("user1");
    expect(creds.technicalPassword).toBe("pass1");
    expect(creds.signingKey).toBe("key1");
    expect(creds.taxNumber).toBe("12345678");
  });

  it("isNavReceiptConfigured returns false when vars missing", () => {
    delete process.env.NAV_RECEIPT_TECH_USER;
    expect(isNavReceiptConfigured()).toBe(false);
  });

  it("isNavReceiptConfigured returns true when all vars set", () => {
    process.env.NAV_RECEIPT_TECH_USER = "u";
    process.env.NAV_RECEIPT_TECH_PASS = "p";
    process.env.NAV_RECEIPT_SIGN_KEY = "k";
    process.env.NAV_RECEIPT_TAX_NUMBER = "t";
    expect(isNavReceiptConfigured()).toBe(true);
  });
});

describe("loadNavReceiptCredentialsFromCompany", () => {
  it("returns null if any field is null", () => {
    const result = loadNavReceiptCredentialsFromCompany({
      navTechnicalUser: "user",
      navTechnicalPassword: null,
      navXmlSignKey: "key",
      taxNumber: "123",
    });
    expect(result).toBeNull();
  });

  it("returns credentials when all fields present", () => {
    const result = loadNavReceiptCredentialsFromCompany({
      navTechnicalUser: "user",
      navTechnicalPassword: "pass",
      navXmlSignKey: "key",
      taxNumber: "12345678",
    });
    expect(result).toEqual({
      technicalUser: "user",
      technicalPassword: "pass",
      signingKey: "key",
      taxNumber: "12345678",
    });
  });

  it("decrypts sealed company secrets (they are stored encrypted)", () => {
    const { encryptNavSecret } = jest.requireActual("@/lib/nav/credentials");
    const originalKey = process.env.NAV_CREDENTIALS_KEY;
    process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 1).toString("base64");
    try {
      const result = loadNavReceiptCredentialsFromCompany({
        navTechnicalUser: "user",
        navTechnicalPassword: encryptNavSecret("pass"),
        navXmlSignKey: encryptNavSecret("key"),
        taxNumber: "12345678",
      });
      expect(result).toMatchObject({ technicalPassword: "pass", signingKey: "key" });
    } finally {
      if (originalKey === undefined) delete process.env.NAV_CREDENTIALS_KEY;
      else process.env.NAV_CREDENTIALS_KEY = originalKey;
    }
  });
});
