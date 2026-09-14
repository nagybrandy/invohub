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
import { resolveInvoiceEmailRecipient, resolveInvoiceEmailRecipients, upsertCompany } from "@/lib/companies/service";

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
    expect(String(storedValues?.navXmlSignKey)).toMatch(/^gcm1:/);

    if (originalKey === undefined) delete process.env.NAV_CREDENTIALS_KEY;
    else process.env.NAV_CREDENTIALS_KEY = originalKey;
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
