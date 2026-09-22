// lib/api/api-key-auth.ts
// Authenticates external API requests via public + secret key pair.
import { authenticateApiKey, type ApiKeyRecord } from "@/lib/api-keys/service";
import { parseApiKeyCredentials } from "@/lib/api-keys/credentials";
import { checkRateLimit } from "@/lib/api/rate-limit";

export { parseApiKeyCredentials };

export type ApiKeyAuthResult =
  | { ok: true; apiKey: ApiKeyRecord; userId: string }
  | { ok: false; response: Response };

export function unauthorizedApiKeyResponse(message = "Invalid API key.") {
  return Response.json({ error: message }, { status: 401 });
}

export async function requireApiKey(request: Request): Promise<ApiKeyAuthResult> {
  const credentials = parseApiKeyCredentials(request);
  if (!credentials) {
    return {
      ok: false,
      response: unauthorizedApiKeyResponse(
        "Missing API credentials. Use Authorization: Bearer <publicKey>:<secretKey> or X-InvoHub-Public-Key + X-InvoHub-Secret-Key headers."
      ),
    };
  }

  const record = await authenticateApiKey(
    credentials.publicKey,
    credentials.secretKey
  );

  if (!record) {
    return { ok: false, response: unauthorizedApiKeyResponse() };
  }

  return { ok: true, apiKey: record, userId: record.userId };
}

export function jsonApiResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** Reasonable default: a single API key can make 120 v1 requests per minute. */
const V1_RATE_LIMIT = 120;
const V1_RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimitedResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Rate limit exceeded. Try again later.", code: "rateLimited" },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) } }
  );
}

/**
 * Every v1 route (app/api/v1/**) should authenticate with this instead of
 * the bare requireApiKey — same auth check, plus a per-API-key rate limit
 * (see lib/api/rate-limit.ts) so a single leaked/misbehaving key can't
 * hammer the API unthrottled.
 */
export async function requireApiKeyForV1(request: Request): Promise<ApiKeyAuthResult> {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth;

  const result = checkRateLimit(`v1:${auth.apiKey.id}`, V1_RATE_LIMIT, V1_RATE_LIMIT_WINDOW_MS);
  if (!result.allowed) {
    return { ok: false, response: rateLimitedResponse(result.retryAfterSeconds) };
  }

  return auth;
}
