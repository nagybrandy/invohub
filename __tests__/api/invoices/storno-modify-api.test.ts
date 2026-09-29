// __tests__/api/invoices/storno-modify-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  createStornoInvoice: jest.fn(),
  createModificationDraft: jest.fn(),
}));

const mockAutoSubmit = jest.fn();
jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: (...args: unknown[]) => mockAutoSubmit(...args),
}));

import { requireSession } from "@/lib/api/session";
import { POST as stornoPOST } from "@/app/api/invoices/[id]/storno+api";
import { POST as modifyPOST } from "@/app/api/invoices/[id]/modify+api";
import {
  createModificationDraft,
  createStornoInvoice,
  getInvoiceById,
} from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockStorno = createStornoInvoice as jest.MockedFunction<typeof createStornoInvoice>;
const mockModify = createModificationDraft as jest.MockedFunction<typeof createModificationDraft>;

function req(path: string) {
  return new Request(`http://localhost${path}`, { method: "POST" });
}

describe("POST /api/invoices/[id]/storno", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await stornoPOST(req("/api/invoices/inv-1/storno"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the source invoice is missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);
    const response = await stornoPOST(req("/api/invoices/missing/storno"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("rejects storno on an already-cancelled invoice", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(makeInvoice({ status: "cancelled" }));
    const response = await stornoPOST(req("/api/invoices/inv-1/storno"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(response.status).toBe(400);
    expect(mockStorno).not.toHaveBeenCalled();
  });

  it("creates the storno document", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const source = makeInvoice({ id: "inv-1" });
    mockGet.mockResolvedValue(source);
    mockStorno.mockResolvedValue(
      makeInvoice({ id: "storno-1", documentType: "storno", originalInvoiceId: "inv-1" })
    );

    const response = await stornoPOST(req("/api/invoices/inv-1/storno"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.invoice.documentType).toBe("storno");
    expect(mockStorno).toHaveBeenCalledWith("user-1", source);
  });
});

describe("POST /api/invoices/[id]/modify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await modifyPOST(req("/api/invoices/inv-1/modify"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the source invoice is missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);
    const response = await modifyPOST(req("/api/invoices/missing/modify"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
  });

  it("creates a correction draft", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const source = makeInvoice({ id: "inv-1" });
    mockGet.mockResolvedValue(source);
    mockModify.mockResolvedValue(
      makeInvoice({
        id: "modify-1",
        documentType: "modify",
        status: "draft",
        invoiceNumber: "",
        modifiesInvoiceId: "inv-1",
      })
    );

    const response = await modifyPOST(req("/api/invoices/inv-1/modify"), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.invoice.documentType).toBe("modify");
    expect(body.invoice.invoiceNumber).toBe("");
    expect(mockModify).toHaveBeenCalledWith("user-1", source);
  });
});
