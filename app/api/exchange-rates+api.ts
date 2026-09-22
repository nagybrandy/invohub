// app/api/exchange-rates+api.ts
// Internal (session-authenticated) exchange rate lookup — backs the
// composer's auto-fetch (components/invoices/composer/useInvoiceComposer.ts)
// for a non-HUF invoice's HUF rate. See lib/exchange-rates/service.ts for
// the cache-first MNB lookup and lib/exchange-rates/mnb.ts for the SOAP
// client.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { MnbFetchError } from "@/lib/exchange-rates/mnb";
import { getExchangeRate } from "@/lib/exchange-rates/service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const currency = url.searchParams.get("currency")?.trim().toUpperCase();
  const date = url.searchParams.get("date")?.trim();

  if (!currency) {
    return jsonResponse({ error: "currency is required." }, 400);
  }
  if (currency === "HUF") {
    return jsonResponse({ error: "HUF never needs an exchange rate." }, 400);
  }
  if (!date || !DATE_RE.test(date)) {
    return jsonResponse({ error: "date is required, as YYYY-MM-DD." }, 400);
  }

  try {
    const result = await getExchangeRate(currency, date);
    if (!result) {
      return jsonResponse(
        { error: "No MNB rate found for this currency near the given date." },
        404
      );
    }
    return jsonResponse(result);
  } catch (error) {
    if (error instanceof MnbFetchError) {
      return jsonResponse({ error: "Could not reach the MNB exchange rate service." }, 502);
    }
    throw error;
  }
}
