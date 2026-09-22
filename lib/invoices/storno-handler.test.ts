// lib/invoices/storno-handler.test.ts
jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  createStornoInvoice: jest.fn(),
}));

import { performStorno } from "@/lib/invoices/storno-handler";
import { createStornoInvoice, getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockCreateStorno = createStornoInvoice as jest.MockedFunction<typeof createStornoInvoice>;

describe("performStorno", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns not_found for a missing/foreign invoice", async () => {
    mockGet.mockResolvedValue(null);
    const result = await performStorno("user-1", "missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(mockCreateStorno).not.toHaveBeenCalled();
  });

  it("refuses a proforma", async () => {
    mockGet.mockResolvedValue(makeInvoice({ documentType: "proforma", status: "proforma" }));
    const result = await performStorno("user-1", "proforma-1");
    expect(result).toEqual({ ok: false, reason: "proforma" });
    expect(mockCreateStorno).not.toHaveBeenCalled();
  });

  it("refuses an already-cancelled invoice", async () => {
    mockGet.mockResolvedValue(makeInvoice({ status: "cancelled" }));
    const result = await performStorno("user-1", "inv-1");
    expect(result).toEqual({ ok: false, reason: "already_cancelled" });
    expect(mockCreateStorno).not.toHaveBeenCalled();
  });

  it("creates the storno document", async () => {
    const source = makeInvoice({ id: "inv-1" });
    mockGet.mockResolvedValue(source);
    const storno = makeInvoice({ id: "storno-1", documentType: "storno", originalInvoiceId: "inv-1" });
    mockCreateStorno.mockResolvedValue(storno);

    const result = await performStorno("user-1", "inv-1");
    expect(result).toEqual({ ok: true, invoice: storno });
    expect(mockCreateStorno).toHaveBeenCalledWith("user-1", source);
  });
});
