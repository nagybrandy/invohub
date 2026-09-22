// lib/exchange-rates/mnb.test.ts
import {
  MNB_SOAP_ENDPOINT,
  MnbFetchError,
  buildGetCurrentExchangeRatesEnvelope,
  buildGetExchangeRatesEnvelope,
  fetchMnbCurrentExchangeRates,
  fetchMnbExchangeRates,
  normalizeRatePerUnit,
  parseMnbRatesXml,
} from "@/lib/exchange-rates/mnb";

// Recorded fixture: a real GetExchangeRates SOAP 1.1 response shape, per
// MNB's own documentation ("Documentation on the MNB's web service on
// current and historic exchange rates", mnb.hu) — the GetExchangeRatesResult
// element is a string whose content is itself XML, XML-escaped once for
// embedding in the outer SOAP envelope. This fixture covers: a multi-day,
// multi-currency window, a unit=100 currency (JPY), and decimal-comma
// values.
const GET_EXCHANGE_RATES_SOAP_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <GetExchangeRatesResponse xmlns="http://www.mnb.hu/webservices/">
      <GetExchangeRatesResult>&lt;MNBExchangeRates&gt;&lt;Day date="2026-09-18"&gt;&lt;Rate unit="1" curr="EUR"&gt;395,12&lt;/Rate&gt;&lt;Rate unit="100" curr="JPY"&gt;265,43&lt;/Rate&gt;&lt;/Day&gt;&lt;Day date="2026-09-21"&gt;&lt;Rate unit="1" curr="EUR"&gt;396,80&lt;/Rate&gt;&lt;Rate unit="100" curr="JPY"&gt;266,01&lt;/Rate&gt;&lt;/Day&gt;&lt;/MNBExchangeRates&gt;</GetExchangeRatesResult>
    </GetExchangeRatesResponse>
  </soap:Body>
</soap:Envelope>`;

const GET_CURRENT_EXCHANGE_RATES_SOAP_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCurrentExchangeRatesResponse xmlns="http://www.mnb.hu/webservices/">
      <GetCurrentExchangeRatesResult>&lt;MNBCurrentExchangeRates&gt;&lt;Day date="2026-09-22"&gt;&lt;Rate unit="1" curr="EUR"&gt;397,50&lt;/Rate&gt;&lt;/Day&gt;&lt;/MNBCurrentExchangeRates&gt;</GetCurrentExchangeRatesResult>
    </GetCurrentExchangeRatesResponse>
  </soap:Body>
</soap:Envelope>`;

const EMPTY_RESULT_SOAP_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetExchangeRatesResponse xmlns="http://www.mnb.hu/webservices/">
      <GetExchangeRatesResult></GetExchangeRatesResult>
    </GetExchangeRatesResponse>
  </soap:Body>
</soap:Envelope>`;

describe("parseMnbRatesXml", () => {
  it("parses every Day/Rate pair, decoding decimal-comma values", () => {
    const inner =
      '<MNBExchangeRates><Day date="2014-12-31">' +
      '<Rate unit="1" curr="EUR">314,89</Rate>' +
      '<Rate unit="1" curr="USD">259,13</Rate>' +
      "</Day></MNBExchangeRates>";

    expect(parseMnbRatesXml(inner)).toEqual([
      { date: "2014-12-31", currency: "EUR", unit: 1, rate: 314.89 },
      { date: "2014-12-31", currency: "USD", unit: 1, rate: 259.13 },
    ]);
  });

  it("keeps the unit attribute for a per-100 currency (e.g. JPY) instead of dividing it", () => {
    const inner =
      '<MNBCurrentExchangeRates><Day date="2015-07-23">' +
      '<Rate unit="100" curr="JPY">226,00</Rate>' +
      "</Day></MNBCurrentExchangeRates>";

    expect(parseMnbRatesXml(inner)).toEqual([
      { date: "2015-07-23", currency: "JPY", unit: 100, rate: 226 },
    ]);
  });

  it("parses multiple Day blocks in document order", () => {
    const inner =
      '<MNBExchangeRates><Day date="2026-09-18"><Rate unit="1" curr="EUR">395,12</Rate></Day>' +
      '<Day date="2026-09-21"><Rate unit="1" curr="EUR">396,80</Rate></Day></MNBExchangeRates>';

    const rates = parseMnbRatesXml(inner);
    expect(rates.map((r) => r.date)).toEqual(["2026-09-18", "2026-09-21"]);
  });

  it("returns an empty array for a blank result (MNB's documented no-data response)", () => {
    expect(parseMnbRatesXml("")).toEqual([]);
  });

  it("skips a malformed Rate rather than throwing", () => {
    const inner =
      '<MNBExchangeRates><Day date="2026-09-18">' +
      '<Rate unit="not-a-number" curr="EUR">395,12</Rate>' +
      "</Day></MNBExchangeRates>";
    expect(parseMnbRatesXml(inner)).toEqual([]);
  });
});

describe("normalizeRatePerUnit", () => {
  it("returns the rate unchanged for unit 1", () => {
    expect(normalizeRatePerUnit({ rate: 395.12, unit: 1 })).toBe(395.12);
  });

  it("divides by the unit for a per-100 currency", () => {
    expect(normalizeRatePerUnit({ rate: 265.43, unit: 100 })).toBeCloseTo(2.6543, 4);
  });
});

describe("buildGetExchangeRatesEnvelope / buildGetCurrentExchangeRatesEnvelope", () => {
  it("builds a SOAP 1.1 envelope with the parameters in order", () => {
    const xml = buildGetExchangeRatesEnvelope("2026-09-12", "2026-09-22", "EUR");
    expect(xml).toContain('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"');
    expect(xml).toContain('<GetExchangeRates xmlns="http://www.mnb.hu/webservices/">');
    expect(xml).toContain("<startDate>2026-09-12</startDate>");
    expect(xml).toContain("<endDate>2026-09-22</endDate>");
    expect(xml).toContain("<currencyNames>EUR</currencyNames>");
  });

  it("builds a parameterless envelope for GetCurrentExchangeRates", () => {
    const xml = buildGetCurrentExchangeRatesEnvelope();
    expect(xml).toContain('<GetCurrentExchangeRates xmlns="http://www.mnb.hu/webservices/" />');
  });
});

describe("fetchMnbExchangeRates", () => {
  function mockFetch(response: { ok: boolean; status?: number; text: string }) {
    return jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status ?? 200,
      text: () => Promise.resolve(response.text),
    }) as unknown as typeof fetch;
  }

  it("posts a SOAP request to the MNB endpoint with the correct SOAPAction", async () => {
    const fetchImpl = mockFetch({ ok: true, text: GET_EXCHANGE_RATES_SOAP_RESPONSE });

    await fetchMnbExchangeRates(
      { startDate: "2026-09-12", endDate: "2026-09-22", currencies: ["EUR"] },
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      MNB_SOAP_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '"http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates"',
        }),
      })
    );
  });

  it("parses the (XML-escaped) inner result into a flat rate list", async () => {
    const fetchImpl = mockFetch({ ok: true, text: GET_EXCHANGE_RATES_SOAP_RESPONSE });

    const rates = await fetchMnbExchangeRates(
      { startDate: "2026-09-12", endDate: "2026-09-22", currencies: ["EUR", "JPY"] },
      fetchImpl
    );

    expect(rates).toEqual([
      { date: "2026-09-18", currency: "EUR", unit: 1, rate: 395.12 },
      { date: "2026-09-18", currency: "JPY", unit: 100, rate: 265.43 },
      { date: "2026-09-21", currency: "EUR", unit: 1, rate: 396.8 },
      { date: "2026-09-21", currency: "JPY", unit: 100, rate: 266.01 },
    ]);
  });

  it("returns an empty array for MNB's documented blank-result case (no quote in range)", async () => {
    const fetchImpl = mockFetch({ ok: true, text: EMPTY_RESULT_SOAP_RESPONSE });
    const rates = await fetchMnbExchangeRates(
      { startDate: "2026-01-01", endDate: "2026-01-02", currencies: ["EUR"] },
      fetchImpl
    );
    expect(rates).toEqual([]);
  });

  it("throws MnbFetchError on a non-OK HTTP response", async () => {
    const fetchImpl = mockFetch({ ok: false, status: 500, text: "" });
    await expect(
      fetchMnbExchangeRates(
        { startDate: "2026-09-12", endDate: "2026-09-22", currencies: ["EUR"] },
        fetchImpl
      )
    ).rejects.toThrow(MnbFetchError);
  });

  it("throws MnbFetchError when the network request itself rejects", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    await expect(
      fetchMnbExchangeRates(
        { startDate: "2026-09-12", endDate: "2026-09-22", currencies: ["EUR"] },
        fetchImpl
      )
    ).rejects.toThrow(MnbFetchError);
  });
});

describe("fetchMnbCurrentExchangeRates", () => {
  it("parses GetCurrentExchangeRatesResult the same way", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(GET_CURRENT_EXCHANGE_RATES_SOAP_RESPONSE),
    }) as unknown as typeof fetch;

    const rates = await fetchMnbCurrentExchangeRates(fetchImpl);

    expect(rates).toEqual([{ date: "2026-09-22", currency: "EUR", unit: 1, rate: 397.5 }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      MNB_SOAP_ENDPOINT,
      expect.objectContaining({
        headers: expect.objectContaining({
          SOAPAction:
            '"http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetCurrentExchangeRates"',
        }),
      })
    );
  });
});
