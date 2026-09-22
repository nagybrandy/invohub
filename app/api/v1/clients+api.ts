// app/api/v1/clients+api.ts
// External API: client list and create, scoped to the key's userId.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { createClient, listClients } from "@/lib/clients/service";
import type { ClientInput } from "@/lib/clients/service";

export async function GET(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const clients = await listClients(auth.userId);
  return jsonApiResponse({ clients });
}

export async function POST(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  let body: ClientInput;
  try {
    body = (await request.json()) as ClientInput;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!body.name?.trim()) {
    return jsonApiResponse({ error: "Client name is required." }, 400);
  }

  const client = await createClient(auth.userId, body);
  return jsonApiResponse({ client }, 201);
}
