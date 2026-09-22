// lib/invoices/modify-handler.test.ts
jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  createModificationDraft: jest.fn(),
}));

import { performModify } from "@/lib/invoices/modify-handler";
import { createModificationDraft, getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockCreateModification = createModificationDraft as jest.MockedFunction<
  typeof createModificationDraft
>;

describe("performModify", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns not_found for a missing/foreign invoice", async () => {
    mockGet.mockResolvedValue(null);
    const result = await performModify("user-1", "missing");
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(mockCreateModification).not.toHaveBeenCalled();
  });

  it("refuses a proforma", async () => {
    mockGet.mockResolvedValue(makeInvoice({ documentType: "proforma", status: "proforma" }));
    const result = await performModify("user-1", "proforma-1");
    expect(result).toEqual({ ok: false, reason: "proforma" });
    expect(mockCreateModification).not.toHaveBeenCalled();
  });

  it("creates a correction draft", async () => {
    const source = makeInvoice({ id: "inv-1" });
    mockGet.mockResolvedValue(source);
    const draft = makeInvoice({
      id: "modify-1",
      documentType: "modify",
      status: "draft",
      invoiceNumber: "",
      modifiesInvoiceId: "inv-1",
    });
    mockCreateModification.mockResolvedValue(draft);

    const result = await performModify("user-1", "inv-1");
    expect(result).toEqual({ ok: true, invoice: draft });
    expect(mockCreateModification).toHaveBeenCalledWith("user-1", source);
  });
});
