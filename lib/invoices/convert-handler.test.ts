// lib/invoices/convert-handler.test.ts
jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  findExistingConversion: jest.fn(),
  convertProformaToInvoice: jest.fn(),
}));

import { performConvert } from "@/lib/invoices/convert-handler";
import {
  convertProformaToInvoice,
  findExistingConversion,
  getInvoiceById,
} from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockFindExisting = findExistingConversion as jest.MockedFunction<typeof findExistingConversion>;
const mockConvert = convertProformaToInvoice as jest.MockedFunction<typeof convertProformaToInvoice>;

describe("performConvert", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns not_found for a missing/foreign invoice", async () => {
    mockGet.mockResolvedValue(null);
    const result = await performConvert("user-1", "missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns notProforma for a non-proforma document", async () => {
    mockGet.mockResolvedValue(makeInvoice({ documentType: "invoice", status: "sent" }));
    const result = await performConvert("user-1", "inv-1");
    expect(result).toEqual({ ok: false, reason: "notProforma" });
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it("returns cancelled for a cancelled proforma", async () => {
    mockGet.mockResolvedValue(makeInvoice({ documentType: "proforma", status: "cancelled" }));
    const result = await performConvert("user-1", "proforma-1");
    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it("returns the new draft invoice for a valid díjbekérő", async () => {
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGet.mockResolvedValue(proforma);
    mockFindExisting.mockResolvedValue(null);
    const draft = makeInvoice({ id: "new-inv-1", documentType: "invoice", status: "draft" });
    mockConvert.mockResolvedValue(draft);

    const result = await performConvert("user-1", "proforma-1");
    expect(result).toEqual({ ok: true, invoice: draft });
    expect(mockConvert).toHaveBeenCalledWith("user-1", proforma);
  });

  it("returns already_converted carrying the existing invoice, creating nothing", async () => {
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGet.mockResolvedValue(proforma);
    const existing = makeInvoice({ id: "existing-inv", documentType: "invoice", status: "draft" });
    mockFindExisting.mockResolvedValue(existing);

    const result = await performConvert("user-1", "proforma-1");
    expect(result).toEqual({ ok: false, reason: "already_converted", invoice: existing });
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it("on a DB unique-violation race, re-looks up and returns the winner as already_converted", async () => {
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGet.mockResolvedValue(proforma);
    mockFindExisting.mockResolvedValueOnce(null);
    mockConvert.mockRejectedValue({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "invoice_converted_from_live_unique_idx"',
    });
    const winner = makeInvoice({ id: "winner-inv", documentType: "invoice", status: "draft" });
    mockFindExisting.mockResolvedValueOnce(winner);

    const result = await performConvert("user-1", "proforma-1");
    expect(result).toEqual({ ok: false, reason: "already_converted", invoice: winner });
    expect(mockFindExisting).toHaveBeenCalledTimes(2);
  });

  it("rethrows when the violation fires but the re-lookup finds nothing", async () => {
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGet.mockResolvedValue(proforma);
    mockFindExisting.mockResolvedValueOnce(null);
    const violation = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "invoice_converted_from_live_unique_idx"',
    };
    mockConvert.mockRejectedValue(violation);
    mockFindExisting.mockResolvedValueOnce(null);

    await expect(performConvert("user-1", "proforma-1")).rejects.toBe(violation);
  });

  it("rethrows a non-unique-violation error unchanged", async () => {
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGet.mockResolvedValue(proforma);
    mockFindExisting.mockResolvedValueOnce(null);
    const boom = new Error("boom");
    mockConvert.mockRejectedValue(boom);

    await expect(performConvert("user-1", "proforma-1")).rejects.toBe(boom);
  });
});
