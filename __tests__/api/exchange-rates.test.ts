// __tests__/api/exchange-rates.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/exchange-rates/service", () => ({
  getExchangeRate: jest.fn(),
}));

import { GET } from "@/app/api/exchange-rates+api";
import { requireSession } from "@/lib/api/session";
import { getExchangeRate } from "@/lib/exchange-rates/service";
import { MnbFetchError } from "@/lib/exchange-rates/mnb";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetExchangeRate = getExchangeRate as jest.MockedFunction<typeof getExchangeRate>;

function req(query: string) {
  return new Request(`http://localhost/api/exchange-rates${query}`);
}

describe("GET /api/exchange-rates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(req("?currency=EUR&date=2026-09-22"));
    expect(response.status).toBe(401);
  });

  it("returns 400 when currency is missing", async () => {
    const response = await GET(req("?date=2026-09-22"));
    expect(response.status).toBe(400);
  });

  it("returns 400 for HUF (never needs a rate)", async () => {
    const response = await GET(req("?currency=HUF&date=2026-09-22"));
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed date", async () => {
    const response = await GET(req("?currency=EUR&date=22-09-2026"));
    expect(response.status).toBe(400);
  });

  it("returns the rate on success", async () => {
    mockGetExchangeRate.mockResolvedValue({
      currency: "EUR",
      rate: 397.5,
      rateDate: "2026-09-22",
      source: "MNB",
    });

    const response = await GET(req("?currency=EUR&date=2026-09-22"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ currency: "EUR", rate: 397.5, rateDate: "2026-09-22", source: "MNB" });
    expect(mockGetExchangeRate).toHaveBeenCalledWith("EUR", "2026-09-22");
  });

  it("uppercases a lowercase currency code", async () => {
    mockGetExchangeRate.mockResolvedValue({
      currency: "EUR",
      rate: 397.5,
      rateDate: "2026-09-22",
      source: "MNB",
    });
    await GET(req("?currency=eur&date=2026-09-22"));
    expect(mockGetExchangeRate).toHaveBeenCalledWith("EUR", "2026-09-22");
  });

  it("returns 404 when MNB has no rate for the window", async () => {
    mockGetExchangeRate.mockResolvedValue(null);
    const response = await GET(req("?currency=EUR&date=1949-01-01"));
    expect(response.status).toBe(404);
  });

  it("returns 502 when MNB is unreachable", async () => {
    mockGetExchangeRate.mockRejectedValue(new MnbFetchError("down"));
    const response = await GET(req("?currency=EUR&date=2026-09-22"));
    expect(response.status).toBe(502);
  });
});
