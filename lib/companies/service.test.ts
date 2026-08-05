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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores navEnvironment on create", async () => {
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

    expect(company.navEnvironment).toBe("production");
    expect(mockDb.insert).toHaveBeenCalled();
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
