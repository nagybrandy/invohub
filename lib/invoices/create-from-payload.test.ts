// lib/invoices/create-from-payload.test.ts
jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
  upsertInvoice: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn().mockResolvedValue(null),
}));

import {
  createInvoiceFromPayload,
  validateExternalInvoiceInput,
  type ExternalInvoiceInput,
} from "@/lib/invoices/create-from-payload";
import { upsertInvoice } from "@/lib/invoices/service";
import { getCompanyByUserId } from "@/lib/companies/service";

const mockUpsertInvoice = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;
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

  it("sets paymentMethod from the payload", async () => {
    const saved = await createInvoiceFromPayload("user-1", { ...input, paymentMethod: "cash" });
    expect(saved.paymentMethod).toBe("cash");
  });

  it("leaves paymentMethod undefined when omitted — no silent transfer default", async () => {
    const saved = await createInvoiceFromPayload("user-1", input);
    expect(saved.paymentMethod).toBeUndefined();
  });
});
