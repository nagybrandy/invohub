// lib/invoices/create-from-payload.test.ts
jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
  upsertInvoice: jest.fn(),
  getInvoiceById: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn().mockResolvedValue(null),
}));

import {
  BuyerAddressMissingError,
  createInvoiceFromPayload,
  updateDraftInvoiceFromPayload,
  validateExternalInvoiceInput,
  type ExternalInvoiceInput,
} from "@/lib/invoices/create-from-payload";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockUpsertInvoice = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;
const mockGetInvoiceById = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockGetCompanyByUserId = getCompanyByUserId as jest.MockedFunction<
  typeof getCompanyByUserId
>;

describe("validateExternalInvoiceInput", () => {
  const valid: ExternalInvoiceInput = {
    clientName: "Client Kft.",
    lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 10000, vatRate: 27 }],
  };

  it("accepts valid payload", () => {
    expect(validateExternalInvoiceInput(valid)).toBeNull();
  });

  it("requires clientName", () => {
    expect(validateExternalInvoiceInput({ ...valid, clientName: "" })).toContain(
      "clientName"
    );
  });

  it("requires lineItems", () => {
    expect(validateExternalInvoiceInput({ clientName: "X", lineItems: [] })).toContain(
      "lineItems"
    );
  });

  it("validates vatRate", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        lineItems: [{ description: "X", quantity: 1, unitPrice: 1, vatRate: 99 as 27 }],
      })
    ).toContain("vatRate");
  });

  it("validates emailTo format", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        emailTo: ["billing@acme.hu", "not-an-email"],
      })
    ).toContain("emailTo");
  });

  it("accepts emailTo as array", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        emailTo: ["billing@acme.hu", "accounting@acme.hu"],
      })
    ).toBeNull();
  });

  it("validates vatCategory", () => {
    expect(
      validateExternalInvoiceInput({
        ...valid,
        lineItems: [{ description: "X", quantity: 1, unitPrice: 1, vatCategory: "BOGUS" as never }],
      })
    ).toContain("vatCategory");
  });

  it("requires exchangeRate for a non-HUF currency (AC11)", () => {
    expect(
      validateExternalInvoiceInput({ ...valid, currency: "EUR" })
    ).toContain("exchangeRate");
  });

  it("accepts a non-HUF currency with a positive exchangeRate (AC11)", () => {
    expect(
      validateExternalInvoiceInput({ ...valid, currency: "EUR", exchangeRate: 390.5 })
    ).toBeNull();
  });

  it("rejects a non-positive exchangeRate (AC11)", () => {
    expect(
      validateExternalInvoiceInput({ ...valid, currency: "EUR", exchangeRate: -1 })
    ).toContain("exchangeRate");
  });

  it("rejects a non-numeric exchangeRate (AC11)", () => {
    expect(
      validateExternalInvoiceInput({ ...valid, currency: "EUR", exchangeRate: "390" as never })
    ).toContain("exchangeRate");
  });

  it("does not require exchangeRate for HUF", () => {
    expect(validateExternalInvoiceInput({ ...valid, currency: "HUF" })).toBeNull();
  });

  it("rejects an unknown paymentMethod, naming the field and the four valid values", () => {
    const error = validateExternalInvoiceInput({
      ...valid,
      paymentMethod: "bitcoin" as never,
    });
    expect(error).not.toBeNull();
    expect(error).toContain("paymentMethod");
    expect(error).toContain("transfer");
    expect(error).toContain("cash");
    expect(error).toContain("card");
    expect(error).toContain("other");
  });

  it("accepts a known paymentMethod", () => {
    expect(
      validateExternalInvoiceInput({ ...valid, paymentMethod: "cash" })
    ).toBeNull();
  });

  it("accepts a payload with no paymentMethod at all", () => {
    expect(validateExternalInvoiceInput(valid)).toBeNull();
  });
});

describe("createInvoiceFromPayload", () => {
  const input: ExternalInvoiceInput = {
    clientName: "Client Kft.",
    lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 10000 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompanyByUserId.mockResolvedValue(null);
    mockUpsertInvoice.mockImplementation((_uid, inv) => Promise.resolve(inv));
  });

  it("leaves invoiceNumber blank so it's assigned at finalize", async () => {
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.invoiceNumber).toBe("");
    expect(saved.documentType).toBe("invoice");
  });

  it("defaults every line to normal 27% VAT for a non-exempt company", async () => {
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.lineItems[0].vatCategory).toBe("normal");
    expect(saved.lineItems[0].vatRate).toBe(27);
  });

  it("defaults every line to AAM/0% for a VAT-exempt company", async () => {
    mockGetCompanyByUserId.mockResolvedValue({
      id: "co-1",
      userId: "user-1",
      name: "Solo EV",
      country: "HU",
      vatExempt: true,
    } as never);
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.lineItems[0].vatCategory).toBe("AAM");
    expect(saved.lineItems[0].vatRate).toBe(0);
  });

  it("respects an explicit vatCategory even for a non-exempt company", async () => {
    const saved = await createInvoiceFromPayload("user-1", {
      ...input,
      lineItems: [{ description: "Export", quantity: 1, unitPrice: 100, vatCategory: "FAD" }],
    });
    expect(saved.lineItems[0].vatCategory).toBe("FAD");
    expect(saved.lineItems[0].vatRate).toBe(0);
  });

  it("defaults currency to HUF for an HU company", async () => {
    mockGetCompanyByUserId.mockResolvedValue({
      id: "co-1",
      userId: "user-1",
      name: "Solo EV",
      country: "HU",
    } as never);
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.currency).toBe("HUF");
  });

  it("defaults currency to HUF when there is no company yet (onboarding)", async () => {
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.currency).toBe("HUF");
  });

  it("sets exchangeRate on the created invoice for a non-HUF payload (AC11)", async () => {
    const saved = await createInvoiceFromPayload("user-1", {
      ...input,
      currency: "EUR",
      exchangeRate: 390.5,
    });
    expect(saved.currency).toBe("EUR");
    expect(saved.exchangeRate).toBe(390.5);
  });

  it("rejects a non-HUF payload with an invalid exchangeRate before ever calling upsertInvoice", async () => {
    await expect(
      createInvoiceFromPayload("user-1", { ...input, currency: "EUR", exchangeRate: -1 })
    ).rejects.toThrow(/exchangeRate/);
    expect(mockUpsertInvoice).not.toHaveBeenCalled();
  });

  it("sets paymentMethod from the payload", async () => {
    const saved = await createInvoiceFromPayload("user-1", { ...input, paymentMethod: "cash" });
    expect(saved.paymentMethod).toBe("cash");
  });

  it("leaves paymentMethod undefined when omitted — no silent transfer default", async () => {
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.paymentMethod).toBeUndefined();
  });

  it("passes the buyer address snapshot and line-item unit through", async () => {
    const saved = await createInvoiceFromPayload("user-1", {
      ...input,
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
      clientCountry: "Magyarország",
      clientEuVatNumber: "HU12345678",
      lineItems: [{ description: "Consulting", quantity: 1, unitPrice: 10000, unit: "óra" }],
    });
    expect(saved.clientZipCode).toBe("1011");
    expect(saved.clientCity).toBe("Budapest");
    expect(saved.clientAddress).toBe("Fő utca 1.");
    expect(saved.clientCountry).toBe("Magyarország");
    expect(saved.clientEuVatNumber).toBe("HU12345678");
    expect(saved.lineItems[0].unit).toBe("óra");
  });

  it("allows a draft (default status) with no buyer address at all", async () => {
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.status).toBe("draft");
    expect(saved.clientAddress).toBeUndefined();
  });

  it("throws BuyerAddressMissingError when creating already-finalized without a complete address (Áfa tv. 169. § e)", async () => {
    await expect(
      createInvoiceFromPayload("user-1", { ...input, status: "sent" })
    ).rejects.toBeInstanceOf(BuyerAddressMissingError);
    expect(mockUpsertInvoice).not.toHaveBeenCalled();
  });

  it("never requires a buyer address for a proforma (díjbekérő) — not an accounting document", async () => {
    const saved = await createInvoiceFromPayload("user-1", {
      ...input,
      documentType: "proforma",
      status: "proforma",
    });
    expect(saved.status).toBe("proforma");
    expect(mockUpsertInvoice).toHaveBeenCalledTimes(1);
  });

  it("succeeds creating already-finalized once the buyer address is complete", async () => {
    const saved = await createInvoiceFromPayload("user-1", {
      ...input,
      status: "sent",
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
    });
    expect(saved.status).toBe("sent");
    expect(mockUpsertInvoice).toHaveBeenCalledTimes(1);
  });
});

describe("updateDraftInvoiceFromPayload", () => {
  const validBody: Partial<ExternalInvoiceInput> = {
    clientName: "Updated Kft.",
    lineItems: [{ description: "New line", quantity: 2, unitPrice: 5000 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCompanyByUserId.mockResolvedValue(null);
    mockUpsertInvoice.mockImplementation((_uid, inv) => Promise.resolve(inv));
  });

  it("returns not_found when the invoice doesn't exist (or belongs to another user)", async () => {
    mockGetInvoiceById.mockResolvedValue(null);
    const result = await updateDraftInvoiceFromPayload("user-1", "missing", validBody);
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(mockUpsertInvoice).not.toHaveBeenCalled();
  });

  it("returns not_draft for a finalized invoice, without ever calling upsertInvoice", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1", status: "sent" }));
    const result = await updateDraftInvoiceFromPayload("user-1", "inv-1", validBody);
    expect(result).toEqual({ ok: false, reason: "not_draft" });
    expect(mockUpsertInvoice).not.toHaveBeenCalled();
  });

  it("returns a validation error using the same rules as create, without calling upsertInvoice", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft" }));
    const result = await updateDraftInvoiceFromPayload("user-1", "inv-1", {
      clientName: "",
      lineItems: [],
    });
    expect(result).toMatchObject({ ok: false, reason: "validation" });
    expect(mockUpsertInvoice).not.toHaveBeenCalled();
  });

  it("updates a draft's fields and persists via upsertInvoice", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ id: "inv-1", status: "draft", clientName: "Old Kft." })
    );
    const result = await updateDraftInvoiceFromPayload("user-1", "inv-1", validBody);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.invoice.clientName).toBe("Updated Kft.");
    expect(result.invoice.lineItems[0].description).toBe("New line");
    expect(mockUpsertInvoice).toHaveBeenCalledTimes(1);
  });

  it("carries the buyer address snapshot and line-item unit through an update", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft" }));
    const result = await updateDraftInvoiceFromPayload("user-1", "inv-1", {
      ...validBody,
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
      lineItems: [{ description: "New line", quantity: 2, unitPrice: 5000, unit: "db" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.invoice.clientZipCode).toBe("1011");
    expect(result.invoice.clientCity).toBe("Budapest");
    expect(result.invoice.clientAddress).toBe("Fő utca 1.");
    expect(result.invoice.lineItems[0].unit).toBe("db");
  });

  it("returns buyer_address_missing when finalizing via update without a complete address", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft" }));
    const result = await updateDraftInvoiceFromPayload("user-1", "inv-1", {
      ...validBody,
      status: "unpaid",
    });
    expect(result).toEqual({ ok: false, reason: "buyer_address_missing" });
    expect(mockUpsertInvoice).not.toHaveBeenCalled();
  });

  it("finalizes via update once the buyer address is complete", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft" }));
    const result = await updateDraftInvoiceFromPayload("user-1", "inv-1", {
      ...validBody,
      status: "unpaid",
      clientZipCode: "1011",
      clientCity: "Budapest",
      clientAddress: "Fő utca 1.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.invoice.status).toBe("unpaid");
  });
});
