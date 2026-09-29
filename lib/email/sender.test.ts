// lib/email/sender.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
  },
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

import { db } from "@/db";
import { getCompanyByUserId } from "@/lib/companies/service";
import { resolveSenderIdentity } from "@/lib/email/sender";

const mockDb = db as unknown as { select: jest.Mock };
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;

function mockUserSelect(rows: unknown[]) {
  mockDb.select.mockReturnValue({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue(rows),
      })),
    })),
  });
}

describe("resolveSenderIdentity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds a '<company> via InvoHub' From name and falls back to the account e-mail for Reply-To (no contact e-mail field on company profile)", async () => {
    mockGetCompany.mockResolvedValue({
      id: "c1",
      userId: "user-1",
      name: "Kovács Anna EV",
      createdAt: "",
      updatedAt: "",
    } as never);
    mockUserSelect([{ email: "anna@kovacs.hu" }]);

    const result = await resolveSenderIdentity("user-1");

    expect(result.fromName).toBe("Kovács Anna EV via InvoHub");
    expect(result.replyTo).toBe("anna@kovacs.hu");
  });

  it("falls back to a bare 'InvoHub' From name when there is no company profile yet", async () => {
    mockGetCompany.mockResolvedValue(null);
    mockUserSelect([{ email: "owner@example.com" }]);

    const result = await resolveSenderIdentity("user-1");

    expect(result.fromName).toBe("InvoHub");
    expect(result.replyTo).toBe("owner@example.com");
  });

  it("omits replyTo when the account e-mail can't be resolved", async () => {
    mockGetCompany.mockResolvedValue({ name: "Acme Kft." } as never);
    mockUserSelect([]);

    const result = await resolveSenderIdentity("user-1");

    expect(result.replyTo).toBeUndefined();
  });

  it("accepts a pre-fetched company profile to avoid a duplicate query", async () => {
    mockUserSelect([{ email: "owner@example.com" }]);

    const result = await resolveSenderIdentity("user-1", { name: "Pre Loaded Bt." } as never);

    expect(mockGetCompany).not.toHaveBeenCalled();
    expect(result.fromName).toBe("Pre Loaded Bt. via InvoHub");
  });

  it("sanitizes the company name against header injection (strips CR/LF and quotes)", async () => {
    mockGetCompany.mockResolvedValue({ name: 'Acme "Kft."\r\nBcc: evil@x.com' } as never);
    mockUserSelect([{ email: "owner@example.com" }]);

    const result = await resolveSenderIdentity("user-1");

    expect(result.fromName).not.toMatch(/[\r\n"]/);
    expect(result.fromName).toBe("Acme Kft. Bcc: evil@x.com via InvoHub");
  });

  it("sanitizes the reply-to address against header injection", async () => {
    mockGetCompany.mockResolvedValue({ name: "Acme Kft." } as never);
    mockUserSelect([{ email: "owner@example.com\r\nBcc:evil@x.com" }]);

    const result = await resolveSenderIdentity("user-1");

    expect(result.replyTo).not.toMatch(/[\r\n]/);
  });

  it("preserves Hungarian diacritics in the From name", async () => {
    mockGetCompany.mockResolvedValue({ name: "Nagy Ünőke Kft." } as never);
    mockUserSelect([{ email: "owner@example.com" }]);

    const result = await resolveSenderIdentity("user-1");

    expect(result.fromName).toBe("Nagy Ünőke Kft. via InvoHub");
  });
});
