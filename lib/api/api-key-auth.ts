// lib/api/api-key-auth.ts
// Authenticates external API requests via public + secret key pair.
import { authenticateApiKey, type ApiKeyRecord } from "@/lib/api-keys/service";
import { parseApiKeyCredentials } from "@/lib/api-keys/credentials";

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
