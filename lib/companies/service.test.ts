// lib/companies/service.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock("@/lib/clients/service", () => ({
  findClientByName: jest.fn(),
}));

import { db } from "@/db";
import { findClientByName } from "@/lib/clients/service";
import {
  getCompanyByUserId,
  resolveInvoiceEmailRecipient,
  resolveInvoiceEmailRecipients,
  toPublicCompany,
  upsertCompany,
  type Company,
} from "@/lib/companies/service";

const mockDb = db as unknown as {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};
const mockFindClient = findClientByName as jest.MockedFunction<typeof findClientByName>;

function mockCompanySelect(row: unknown | null) {
  mockDb.select.mockReturnValue({
    from: jest.fn(() => ({
      where: jest.fn().mockResolvedValue(row ? [row] : []),
    })),
  });
}

describe("upsertCompany", () => {
  const originalProdFlag = process.env.NAV_PRODUCTION_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalProdFlag === undefined) delete process.env.NAV_PRODUCTION_ENABLED;
    else process.env.NAV_PRODUCTION_ENABLED = originalProdFlag;
  });

  it("stores navEnvironment on create (production requires NAV_PRODUCTION_ENABLED)", async () => {
    process.env.NAV_PRODUCTION_ENABLED = "true";
    mockCompanySelect(null);
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([
          {
            id: "c1",
            userId: "user-1",
            name: "Demo Kft.",
            taxNumber: null,
            euVatNumber: null,
            address: null,
            city: null,
            zipCode: null,
            country: "HU",
            bankAccount: null,
            logoUrl: null,
            invoiceEmailTo: null,
            invoiceEmailCc: null,
            navTechnicalUser: null,
            navTechnicalPassword: null,
            navXmlSignKey: null,
            navEnvironment: "production",
            vatExempt: true,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        ]),
      })),
    });

    const company = await upsertCompany("user-1", {
      name: "Demo Kft.",
      navEnvironment: "production",
      vatExempt: true,
    });

    expect(company.navEnvironment).toBe("production");
    expect(company.vatExempt).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("defaults vatExempt to false when the row has no value (legacy rows)", async () => {
    mockCompanySelect(null);
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([
          {
            id: "c1",
            userId: "user-1",
            name: "Demo Kft.",
            country: "HU",
            navEnvironment: "test",
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        ]),
      })),
    });

    const company = await upsertCompany("user-1", { name: "Demo Kft." });
    expect(company.vatExempt).toBe(false);
  });

  it("falls back to demo when production is requested but not enabled", async () => {
    delete process.env.NAV_PRODUCTION_ENABLED;
    mockCompanySelect(null);
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([
          {
            id: "c1",
            userId: "user-1",
            name: "Demo Kft.",
            taxNumber: null,
            euVatNumber: null,
            address: null,
            city: null,
            zipCode: null,
            country: "HU",
            bankAccount: null,
            logoUrl: null,
            invoiceEmailTo: null,
            invoiceEmailCc: null,
            navTechnicalUser: null,
            navTechnicalPassword: null,
            navXmlSignKey: null,
            navXmlChangeKey: null,
            navEnvironment: "production",
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
          },
        ]),
      })),
    });

    const company = await upsertCompany("user-1", {
      name: "Demo Kft.",
      navEnvironment: "production",
    });

    expect(company.navEnvironment).toBe("demo");
  });

  it("encrypts NAV secret fields before storing, and refuses without NAV_CREDENTIALS_KEY", async () => {
    const originalKey = process.env.NAV_CREDENTIALS_KEY;
    delete process.env.NAV_CREDENTIALS_KEY;
    mockCompanySelect(null);
    mockDb.insert.mockReturnValue({
      values: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([{}]) })),
    });

    await expect(
      upsertCompany("user-1", { name: "Demo Kft.", navXmlSignKey: "plain-sign-key" })
    ).rejects.toThrow(/NAV_CREDENTIALS_KEY/);

    process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 3).toString("base64");
    let storedValues: Record<string, unknown> | undefined;
    mockDb.insert.mockReturnValue({
      values: jest.fn((v: Record<string, unknown>) => {
        storedValues = v;
        return { returning: jest.fn().mockResolvedValue([{ ...v, id: "c1", userId: "user-1" }]) };
      }),
    });

    await upsertCompany("user-1", { name: "Demo Kft.", navXmlSignKey: "plain-sign-key" });
    expect(storedValues?.navXmlSignKey).toEqual(expect.any(String));
    expect(storedValues?.navXmlSignKey).not.toBe("plain-sign-key");
    expect(String(storedValues?.navXmlSignKey)).toMatch(/^gcm2:/);

    if (originalKey === undefined) delete process.env.NAV_CREDENTIALS_KEY;
    else process.env.NAV_CREDENTIALS_KEY = originalKey;
  });

  describe("NAV secrets", () => {
    const originalKey = process.env.NAV_CREDENTIALS_KEY;
    beforeEach(() => {
      process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(32, 3).toString("base64");
    });
    afterEach(() => {
      if (originalKey === undefined) delete process.env.NAV_CREDENTIALS_KEY;
      else process.env.NAV_CREDENTIALS_KEY = originalKey;
    });

    function existingRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "c1",
        userId: "user-1",
        name: "Demo Kft.",
        navTechnicalUser: "nav-user",
        navTechnicalPassword: "gcm2:k1:stored-pw-iv:tag:ct",
        navXmlSignKey: "gcm2:k1:stored-sign-iv:tag:ct",
        navXmlChangeKey: "gcm2:k1:stored-change-iv:tag:ct",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        ...overrides,
      };
    }

    function captureUpdate() {
      const captured: { values?: Record<string, unknown> } = {};
      mockDb.update.mockReturnValue({
        set: jest.fn((v: Record<string, unknown>) => {
          captured.values = v;
          return {
            where: jest.fn(() => ({
              returning: jest.fn().mockResolvedValue([{ ...existingRow(), ...v }]),
            })),
          };
        }),
      });
      return captured;
    }

    it("leaves stored secrets untouched when the client omits them (no need to resend)", async () => {
      mockCompanySelect(existingRow());
      const captured = captureUpdate();

      await upsertCompany("user-1", { name: "Renamed Kft." });

      expect(captured.values?.navTechnicalPassword).toBe("gcm2:k1:stored-pw-iv:tag:ct");
      expect(captured.values?.navXmlSignKey).toBe("gcm2:k1:stored-sign-iv:tag:ct");
      expect(captured.values?.navXmlChangeKey).toBe("gcm2:k1:stored-change-iv:tag:ct");
    });

    it("treats a masked value echoed back by the client as 'leave unchanged'", async () => {
      mockCompanySelect(existingRow());
      const captured = captureUpdate();

      await upsertCompany("user-1", {
        name: "Demo Kft.",
        navTechnicalPassword: "••••••••",
        navXmlSignKey: "••••",
      });

      expect(captured.values?.navTechnicalPassword).toBe("gcm2:k1:stored-pw-iv:tag:ct");
      expect(captured.values?.navXmlSignKey).toBe("gcm2:k1:stored-sign-iv:tag:ct");
    });

    it("does not decrypt NAV secrets when reading the company (they stay sealed until request signing)", async () => {
      // An undecryptable value must not break ordinary reads (PDF, e-mail, settings).
      mockCompanySelect(existingRow());
      const company = await getCompanyByUserId("user-1");

      expect(company?.name).toBe("Demo Kft.");
      expect(company?.navTechnicalPassword).toBe("gcm2:k1:stored-pw-iv:tag:ct");
      expect(company?.navXmlSignKey).toBe("gcm2:k1:stored-sign-iv:tag:ct");
    });
  });
});

describe("resolveInvoiceEmailRecipient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefers explicit override", async () => {
    const email = await resolveInvoiceEmailRecipient("u1", "Acme", "override@test.com");
    expect(email).toBe("override@test.com");
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("uses company invoiceEmailTo when set", async () => {
    mockCompanySelect({
      id: "c1",
      userId: "u1",
      name: "Demo",
      invoiceEmailTo: "company@test.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const email = await resolveInvoiceEmailRecipient("u1", "Acme");
    expect(email).toBe("company@test.com");
  });

  it("falls back to client email", async () => {
    mockCompanySelect(null);
    mockFindClient.mockResolvedValue({
      id: "cl1",
      userId: "u1",
      name: "Acme",
      email: "client@test.com",
      createdAt: "",
      updatedAt: "",
    });

    const email = await resolveInvoiceEmailRecipient("u1", "Acme");
    expect(email).toBe("client@test.com");
  });

  it("returns null when nothing configured", async () => {
    mockCompanySelect(null);
    mockFindClient.mockResolvedValue(null);

    const email = await resolveInvoiceEmailRecipient("u1", "Acme");
    expect(email).toBeNull();
  });
});

describe("resolveInvoiceEmailRecipients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns override list without fallback lookup", async () => {
    const emails = await resolveInvoiceEmailRecipients("u1", "Acme", [
      "a@test.com",
      "b@test.com",
    ]);
    expect(emails).toEqual(["a@test.com", "b@test.com"]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("falls back to single recipient resolution", async () => {
    mockCompanySelect({
      id: "c1",
      userId: "u1",
      name: "Demo",
      invoiceEmailTo: "company@test.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const emails = await resolveInvoiceEmailRecipients("u1", "Acme");
    expect(emails).toEqual(["company@test.com"]);
  });
});

describe("toPublicCompany", () => {
  const fullCompany: Company = {
    id: "c1",
    userId: "u1",
    name: "Demo Kft.",
    navTechnicalUser: "nav-user",
    navTechnicalPassword: "decrypted-password",
    navXmlSignKey: "decrypted-sign-key",
    navXmlChangeKey: "decrypted-change-key",
    createdAt: "",
    updatedAt: "",
  };

  it("strips the decrypted NAV secret values", () => {
    const publicCompany = toPublicCompany(fullCompany);
    expect(publicCompany).not.toHaveProperty("navTechnicalPassword");
    expect(publicCompany).not.toHaveProperty("navXmlSignKey");
    expect(publicCompany).not.toHaveProperty("navXmlChangeKey");
    expect(JSON.stringify(publicCompany)).not.toContain("decrypted-");
  });

  it("reports whether each secret is set", () => {
    expect(toPublicCompany(fullCompany).navTechnicalPasswordSet).toBe(true);
    expect(toPublicCompany(fullCompany).navXmlSignKeySet).toBe(true);
    expect(toPublicCompany(fullCompany).navXmlChangeKeySet).toBe(true);

    const noSecrets = toPublicCompany({ ...fullCompany, navTechnicalPassword: undefined, navXmlSignKey: undefined, navXmlChangeKey: undefined });
    expect(noSecrets.navTechnicalPasswordSet).toBe(false);
    expect(noSecrets.navXmlSignKeySet).toBe(false);
    expect(noSecrets.navXmlChangeKeySet).toBe(false);
  });

  it("keeps non-secret fields intact", () => {
    const publicCompany = toPublicCompany(fullCompany);
    expect(publicCompany.name).toBe("Demo Kft.");
    expect(publicCompany.navTechnicalUser).toBe("nav-user");
  });
});
