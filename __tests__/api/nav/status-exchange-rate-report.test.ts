// __tests__/api/nav/status-exchange-rate-report.test.ts
// GET /api/nav/status?invoiceId=… always returns an exchangeRateReport
// field (AC4), on top of the existing submissions payload (unchanged).
// docs/plans/2026-09-21-retro-correct-non-huf-invoices-nav-modify.md
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/nav/client", () => ({
  getNavClient: jest.fn(),
}));

jest.mock("@/lib/nav/resolve-credentials", () => ({
  resolveNavCredentials: jest.fn(),
}));

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
  },
}));

import { requireSession } from "@/lib/api/session";
import { getInvoiceById } from "@/lib/invoices/service";
import { db } from "@/db";
import { GET } from "@/app/api/nav/status+api";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoiceById = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockDb = db as unknown as { select: jest.Mock };

function mockSubmissionRows(rows: unknown[]) {
  mockDb.select.mockReturnValue({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn().mockResolvedValue(rows),
      })),
    })),
  });
}

function makeRequest(invoiceId: string) {
  return new Request(`http://localhost/api/nav/status?invoiceId=${encodeURIComponent(invoiceId)}`);
}

describe("GET /api/nav/status — exchangeRateReport (AC4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("4.1/4.2 — no submissions → exchangeRateReport is exactly { kind: 'none' }, submissions unchanged", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: 398.5 }) as never);
    mockSubmissionRows([]);

    const res = await GET(makeRequest("inv-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.submissions).toEqual([]);
    expect(body.exchangeRateReport).toEqual({ kind: "none" });
  });

  it("4.1 — misreported: enriches the classification with computeNavHufMisreport's HUF amounts", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({
        id: "inv-1",
        currency: "EUR",
        exchangeRate: 400,
        lineItems: [
          { id: "l1", description: "A", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" },
        ],
      }) as never
    );
    mockSubmissionRows([
      {
        mode: "test",
        status: "done",
        submittedAt: "2026-09-16T00:00:00.000Z",
        createdAt: "2026-09-16T00:00:00.000Z",
        reportedCurrency: "EUR",
        reportedExchangeRate: "1",
      },
    ]);

    const res = await GET(makeRequest("inv-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exchangeRateReport.kind).toBe("misreported");
    expect(body.exchangeRateReport.reportedRate).toBe(1);
    expect(body.exchangeRateReport.currentRate).toBe(400);
    expect(body.exchangeRateReport.source).toBe("recorded");
    expect(body.exchangeRateReport.reportedVatHuf).toBe(27);
    expect(body.exchangeRateReport.correctVatHuf).toBe(10800);
    expect(body.exchangeRateReport.deltaVatHuf).toBe(10773);
  });

  it("reads the reported HUF VAT back from the persisted nav_submission.reportedVatHuf column instead of recomputing it from the invoice's current line items", async () => {
    // The invoice's line items today would recompute a different reported
    // VAT (100 EUR net @ 27% -> 27 at rate 1) than what NAV's copy actually
    // held — the persisted column (55) must win.
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({
        id: "inv-1",
        currency: "EUR",
        exchangeRate: 400,
        lineItems: [
          { id: "l1", description: "A", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" },
        ],
      }) as never
    );
    mockSubmissionRows([
      {
        mode: "test",
        status: "done",
        submittedAt: "2026-09-16T00:00:00.000Z",
        createdAt: "2026-09-16T00:00:00.000Z",
        reportedCurrency: "EUR",
        reportedExchangeRate: "1",
        reportedVatHuf: "55",
      },
    ]);

    const res = await GET(makeRequest("inv-1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exchangeRateReport.kind).toBe("misreported");
    expect(body.exchangeRateReport.reportedVatHuf).toBe(55);
    expect(body.exchangeRateReport.correctVatHuf).toBe(10800);
    expect(body.exchangeRateReport.deltaVatHuf).toBe(10745);
  });

  it("4.1 — ok classification carries no HUF amounts", async () => {
    mockGetInvoiceById.mockResolvedValue(
      makeInvoice({ id: "inv-1", currency: "EUR", exchangeRate: 398.5 }) as never
    );
    mockSubmissionRows([
      {
        mode: "test",
        status: "done",
        submittedAt: "2026-09-16T00:00:00.000Z",
        createdAt: "2026-09-16T00:00:00.000Z",
        reportedCurrency: "EUR",
        reportedExchangeRate: "398.5",
      },
    ]);

    const res = await GET(makeRequest("inv-1"));
    const body = await res.json();

    expect(body.exchangeRateReport).toEqual({ kind: "ok" });
  });

  it("4.3 — returns 401 without a session (auth guard unchanged)", async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET(makeRequest("inv-1"));
    expect(res.status).toBe(401);
  });

  it("4.3 — returns 404 for a missing invoice (unchanged)", async () => {
    mockGetInvoiceById.mockResolvedValue(null);
    const res = await GET(makeRequest("inv-missing"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toBeTruthy();
  });

  it("4.3 — submissions payload shape (status/transactionId) is unchanged", async () => {
    mockGetInvoiceById.mockResolvedValue(makeInvoice({ id: "inv-1" }) as never);
    mockSubmissionRows([{ status: "done", transactionId: "TX-1" }]);

    const res = await GET(makeRequest("inv-1"));
    const body = await res.json();

    expect(body.submissions).toEqual([{ status: "done", transactionId: "TX-1" }]);
  });
});
