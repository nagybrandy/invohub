// lib/invoices/service.test.ts
jest.mock("@/db", () => ({ db: {} }));

import { duplicateInvoice, stornoInvoice } from "@/lib/invoices/service";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("@/lib/id", () => ({
  createId: jest
    .fn()
    .mockReturnValueOnce("new-inv-id")
    .mockReturnValueOnce("new-line-id")
    .mockReturnValueOnce("storno-inv-id")
    .mockReturnValueOnce("storno-line-id"),
}));

describe("duplicateInvoice", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("creates draft copy with new ids", () => {
    const source = makeInvoice();
    const copy = duplicateInvoice(source);
    expect(copy.id).toBe("new-inv-id");
    expect(copy.invoiceNumber).toBe("INV-2026-001-COPY");
    expect(copy.status).toBe("draft");
    expect(copy.lineItems[0].id).toBe("new-line-id");
    expect(copy.createdAt).toBe("2026-07-01T12:00:00.000Z");
  });
});

describe("stornoInvoice", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("negates quantities and marks cancelled", () => {
    const source = makeInvoice({
      lineItems: [makeLineItem({ quantity: 2 })],
    });
    const storno = stornoInvoice(source);
    expect(storno.invoiceNumber).toBe("INV-2026-001-STORNO");
    expect(storno.status).toBe("cancelled");
    expect(storno.lineItems[0].quantity).toBe(-2);
    expect(storno.notes).toContain("INV-2026-001");
  });
});
