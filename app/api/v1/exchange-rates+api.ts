// app/api/v1/exchange-rates+api.ts
// External API: the same MNB exchange rate lookup as app/api/exchange-
// rates+api.ts, authenticated with an API key instead of a session — lets
// an external integration fetch the official rate it would otherwise have
// to supply manually on POST /api/v1/invoices (see docs/external-api.md).
import { jsonApiResponse, requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { MnbFetchError } from "@/lib/exchange-rates/mnb";
import { getExchangeRate } from "@/lib/exchange-rates/service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const currency = url.searchParams.get("currency")?.trim().toUpperCase();
  const date = url.searchParams.get("date")?.trim();

  if (!currency) {
    return jsonApiResponse({ error: "currency is required." }, 400);
  }
  if (currency === "HUF") {
    return jsonApiResponse({ error: "HUF never needs an exchange rate." }, 400);
  }
  if (!date || !DATE_RE.test(date)) {
    return jsonApiResponse({ error: "date is required, as YYYY-MM-DD." }, 400);
  }

  try {
    const result = await getExchangeRate(currency, date);
    if (!result) {
      return jsonApiResponse(
        { error: "No MNB rate found for this currency near the given date." },
        404
      );
    }
    return jsonApiResponse(result);
  } catch (error) {
    if (error instanceof MnbFetchError) {
      return jsonApiResponse({ error: "Could not reach the MNB exchange rate service." }, 502);
    }
    throw error;
  }
}
