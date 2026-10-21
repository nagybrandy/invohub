// app/api/exchange-rates/currencies+api.ts
// The currencies an invoice or receipt may be issued in: HUF plus every
// currency the MNB currently publishes a rate for (primaries first).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getSupportedCurrencies } from "@/lib/exchange-rates/currencies";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  return jsonResponse(await getSupportedCurrencies());
}
