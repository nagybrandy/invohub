// app/api/clients+api.ts
// Client list and create.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { requireAccountantAccess } from "@/lib/api/permissions";
import { createClient, findClientByTaxNumber, listClients } from "@/lib/clients/service";
import type { ClientInput } from "@/lib/clients/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const url = new URL(request.url);
  const taxNumber = url.searchParams.get("taxNumber");

  if (taxNumber) {
    const client = await findClientByTaxNumber(session.user.id, taxNumber);
    return jsonResponse({ client });
  }

  const clients = await listClients(session.user.id);
  return jsonResponse({ clients });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const body = (await request.json()) as ClientInput;
  if (!body.name?.trim()) {
    return jsonResponse({ error: "Client name is required." }, 400);
  }

  const client = await createClient(session.user.id, body);
  return jsonResponse({ client }, 201);
}
