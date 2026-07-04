// app/api/api-keys+api.ts
// List and create API keys for external invoice integration.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { createApiKey, listApiKeys } from "@/lib/api-keys/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const keys = await listApiKeys(session.user.id);
  return jsonResponse({ keys });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { name?: string };
  const created = await createApiKey(session.user.id, body.name ?? "External API");
  return jsonResponse({ key: created }, 201);
}
