// app/api/clients/[id]+api.ts
// Single client CRUD.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { requireAccountantAccess } from "@/lib/api/permissions";
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
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const { id } = await params;
  const client = await getClientById(session.user.id, id);
  if (!client) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ client });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const { id } = await params;
  const body = (await request.json()) as Partial<ClientInput>;
  const client = await updateClient(session.user.id, id, body);
  if (!client) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ client });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const { id } = await params;
  const deleted = await deleteClientById(session.user.id, id);
  if (!deleted) return jsonResponse({ error: "Not found" }, 404);
  return new Response(null, { status: 204 });
}
