// lib/companies/service.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock("@/lib/clients/service", () => ({
  findClientByName: jest.fn(),
}));

import { db } from "@/db";
import { findClientByName } from "@/lib/clients/service";
import { resolveInvoiceEmailRecipient } from "@/lib/companies/service";

const mockDb = db as unknown as { select: jest.Mock };
const mockFindClient = findClientByName as jest.MockedFunction<typeof findClientByName>;

function mockCompanySelect(row: unknown | null) {
  mockDb.select.mockReturnValue({
    from: jest.fn(() => ({
      where: jest.fn().mockResolvedValue(row ? [row] : []),
    })),
  });
}

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
