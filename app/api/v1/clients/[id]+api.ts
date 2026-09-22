// app/api/v1/clients/[id]+api.ts
// External API: single client CRUD, scoped to the key's userId — another
// user's client id is always a 404, never a 403.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import {
  deleteClientById,
  getClientById,
  updateClient,
} from "@/lib/clients/service";
import type { ClientInput } from "@/lib/clients/service";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const client = await getClientById(auth.userId, id);
  if (!client) return jsonApiResponse({ error: "Client not found." }, 404);
  return jsonApiResponse({ client });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  let body: Partial<ClientInput>;
  try {
    body = (await request.json()) as Partial<ClientInput>;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  const client = await updateClient(auth.userId, id, body);
  if (!client) return jsonApiResponse({ error: "Client not found." }, 404);
  return jsonApiResponse({ client });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const deleted = await deleteClientById(auth.userId, id);
  if (!deleted) return jsonApiResponse({ error: "Client not found." }, 404);
  return new Response(null, { status: 204 });
}
