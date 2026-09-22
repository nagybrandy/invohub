// lib/exchange-rates/mnb.ts
// SOAP client + parser for the MNB (Magyar Nemzeti Bank) public exchange
// rate web service (http://www.mnb.hu/arfolyamok.asmx). No SOAP/XML
// library dependency — same small regex-based approach as lib/nav/xml-
// utils.ts, appropriate here too since the MNB response shape is fixed and
// well-documented (see the source below), not attacker-controlled.
//
// Source: "Documentation on the MNB's web service on current and historic
// exchange rates" (mnb.hu, fetched 2026-09-22) — the WSDL types both
// GetExchangeRatesResult and GetCurrentExchangeRatesResult as plain
// xs:string; the string's content is itself an XML document (XML-escaped
// once when embedded in the SOAP response), e.g.:
//
//   <MNBExchangeRates>
//     <Day date="2014-12-31">
//       <Rate unit="1" curr="EUR">314,89</Rate>
//       <Rate unit="1" curr="USD">259,13</Rate>
//     </Day>
//   </MNBExchangeRates>
//
// `unit` matters: most currencies quote 1 unit, but low-value ones (e.g.
// JPY, IDR, KRW) quote per 100 — see normalizeRatePerUnit. The rate text
// itself uses a decimal COMMA (Hungarian formatting), not a dot.
//
// GetExchangeRates(startDate, endDate, currencyNames) returns a <Day> per
// date that actually had a quote in range (MNB doesn't publish on
// weekends/bank holidays — those dates are simply absent, not zero/blank
// Days). GetCurrentExchangeRates() takes no input and returns the single
// most recent day's rates, root-tagged <MNBCurrentExchangeRates> instead —
// structurally identical <Day>/<Rate> content, just a different outer tag,
// which is why parseMnbRatesXml below doesn't care about the root name.

export const MNB_SOAP_ENDPOINT = "http://www.mnb.hu/arfolyamok.asmx";
const MNB_NAMESPACE = "http://www.mnb.hu/webservices/";
const SOAP_ACTION_GET_EXCHANGE_RATES = `${MNB_NAMESPACE}MNBArfolyamServiceSoap/GetExchangeRates`;
const SOAP_ACTION_GET_CURRENT_EXCHANGE_RATES = `${MNB_NAMESPACE}MNBArfolyamServiceSoap/GetCurrentExchangeRates`;

export type MnbRate = {
  /** YYYY-MM-DD — the MNB-published day this rate is for. */
  date: string;
  /** ISO 4217 three-letter code, e.g. "EUR", "JPY". */
  currency: string;
  /** How many units of `currency` the `rate` text is quoted for (1 or 100). */
  unit: number;
  /** HUF for `unit` units of `currency`, as published (NOT yet divided by unit). */
  rate: number;
};

/** HUF per single unit of the rate's currency — the number invoices actually need. */
export function normalizeRatePerUnit(rate: Pick<MnbRate, "rate" | "unit">): number {
  return rate.rate / rate.unit;
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Un-escapes the single level of XML-entity-encoding around the SOAP result string. */
function unescapeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function buildGetExchangeRatesEnvelope(
  startDate: string,
  endDate: string,
  currencyNames: string
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetExchangeRates xmlns="${MNB_NAMESPACE}">
      <startDate>${escapeXmlText(startDate)}</startDate>
      <endDate>${escapeXmlText(endDate)}</endDate>
      <currencyNames>${escapeXmlText(currencyNames)}</currencyNames>
    </GetExchangeRates>
  </soap:Body>
</soap:Envelope>`;
}

export function buildGetCurrentExchangeRatesEnvelope(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCurrentExchangeRates xmlns="${MNB_NAMESPACE}" />
  </soap:Body>
</soap:Envelope>`;
}

/** First `<tag>...</tag>` text content (no namespace prefix expected here — SOAP body elements aren't prefixed), or null. */
function extractTagText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(re);
  return match ? match[1] : null;
}

/**
 * Parses the inner MNB result XML (already un-escaped) into a flat list of
 * rates across every `<Day>` it contains. Root-tag-agnostic — works for both
 * <MNBExchangeRates> and <MNBCurrentExchangeRates>.
 */
export function parseMnbRatesXml(innerXml: string): MnbRate[] {
  const rates: MnbRate[] = [];
  const dayRe = /<Day\s+date="([^"]+)"\s*>([\s\S]*?)<\/Day>/g;
  let dayMatch: RegExpExecArray | null;
  while ((dayMatch = dayRe.exec(innerXml))) {
    const [, date, dayBody] = dayMatch;
    const rateRe = /<Rate\s+unit="([^"]+)"\s+curr="([^"]+)"\s*>([^<]*)<\/Rate>/g;
    let rateMatch: RegExpExecArray | null;
    while ((rateMatch = rateRe.exec(dayBody))) {
      const [, unitRaw, curr, valueRaw] = rateMatch;
      const unit = Number.parseInt(unitRaw, 10);
      const rate = Number.parseFloat(valueRaw.trim().replace(",", "."));
      if (!Number.isFinite(unit) || unit <= 0 || !Number.isFinite(rate)) continue;
      rates.push({ date, currency: curr, unit, rate });
    }
  }
  return rates;
}

export class MnbFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MnbFetchError";
  }
}

async function postSoapRequest(
  envelope: string,
  soapAction: string,
  fetchImpl: typeof fetch
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(MNB_SOAP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${soapAction}"`,
      },
      body: envelope,
    });
  } catch (error) {
    throw new MnbFetchError(
      `Failed to reach the MNB exchange rate service: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    throw new MnbFetchError(`MNB exchange rate service responded with ${response.status}.`);
  }

  return response.text();
}

/**
 * GetExchangeRates(startDate, endDate, currencyNames) — historic rates in a
 * date range. `currencies` is a list of ISO codes (e.g. ["EUR"]); MNB
 * accepts a comma-separated list. Dates are "YYYY-MM-DD".
 */
export async function fetchMnbExchangeRates(
  params: { startDate: string; endDate: string; currencies: string[] },
  fetchImpl: typeof fetch = fetch
): Promise<MnbRate[]> {
  const envelope = buildGetExchangeRatesEnvelope(
    params.startDate,
    params.endDate,
    params.currencies.join(",")
  );
  const soapXml = await postSoapRequest(envelope, SOAP_ACTION_GET_EXCHANGE_RATES, fetchImpl);
  const resultText = extractTagText(soapXml, "GetExchangeRatesResult");
  if (!resultText) return [];
  return parseMnbRatesXml(unescapeXmlEntities(resultText));
}

/** GetCurrentExchangeRates() — the latest published day's full rate table. */
export async function fetchMnbCurrentExchangeRates(
  fetchImpl: typeof fetch = fetch
): Promise<MnbRate[]> {
  const envelope = buildGetCurrentExchangeRatesEnvelope();
  const soapXml = await postSoapRequest(
    envelope,
    SOAP_ACTION_GET_CURRENT_EXCHANGE_RATES,
    fetchImpl
  );
  const resultText = extractTagText(soapXml, "GetCurrentExchangeRatesResult");
  if (!resultText) return [];
  return parseMnbRatesXml(unescapeXmlEntities(resultText));
}
