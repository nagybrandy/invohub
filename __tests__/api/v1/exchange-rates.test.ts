// __tests__/api/v1/exchange-rates.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/exchange-rates/service", () => ({
  getExchangeRate: jest.fn(),
}));

import { GET } from "@/app/api/v1/exchange-rates+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { getExchangeRate } from "@/lib/exchange-rates/service";
import { MnbFetchError } from "@/lib/exchange-rates/mnb";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockGetExchangeRate = getExchangeRate as jest.MockedFunction<typeof getExchangeRate>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(query: string) {
  return new Request(`http://localhost/api/v1/exchange-rates${query}`);
}

describe("GET /api/v1/exchange-rates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authOk();
  });

  it("returns 401 without a valid API key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await GET(req("?currency=EUR&date=2026-09-22"));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a missing date", async () => {
    const response = await GET(req("?currency=EUR"));
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
    expect(body.rate).toBe(397.5);
  });

  it("returns 502 when MNB is unreachable", async () => {
    mockGetExchangeRate.mockRejectedValue(new MnbFetchError("down"));
    const response = await GET(req("?currency=EUR&date=2026-09-22"));
    expect(response.status).toBe(502);
  });
});
