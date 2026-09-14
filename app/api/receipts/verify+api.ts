// app/api/receipts/verify+api.ts
// Public receipt verification by QR token (no auth).
import { checkRateLimit, clientIpFromHeaders } from "@/lib/api/rate-limit";
import { getPublicReceiptByToken } from "@/lib/receipts/service";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

// Generous enough for a real customer re-scanning/re-loading a receipt,
// tight enough to meaningfully slow down token enumeration against this
// unauthenticated, no-session endpoint.
const RATE_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const { allowed, retryAfterSeconds } = checkRateLimit(
    `receipts-verify:${ip}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS
  );
  if (!allowed) {
    return jsonResponse(
      { error: "Too many requests. Please try again shortly." },
      429
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return jsonResponse({ error: "token query parameter is required." }, 400);
  }

  const receipt = await getPublicReceiptByToken(token);
  if (!receipt) {
    return jsonResponse({ error: "Receipt not found or invalid token." }, 404);
  }

  return jsonResponse({ receipt });
}
