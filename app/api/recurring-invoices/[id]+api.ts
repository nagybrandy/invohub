// app/api/recurring-invoices/[id]+api.ts
// One recurring template: read, edit schedule / pause / resume, delete.
// Always scoped to the active billing account (session.user.id).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { parsePatchBody } from "@/lib/recurring/input";
import { RecurringTemplateError, deleteTemplate, getTemplate, updateTemplate } from "@/lib/recurring/service";

type Params = { id: string };

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const template = await getTemplate(session.user.id, await resolveIdParam(request, params));
  if (!template) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ template });
}

export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const patch = parsePatchBody(await request.json().catch(() => null));
  if (!patch) return jsonResponse({ error: "Invalid body", code: "invalidInput" }, 400);

  try {
    const template = await updateTemplate(session.user.id, await resolveIdParam(request, params), patch);
    if (!template) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ template });
  } catch (error) {
    if (error instanceof RecurringTemplateError) {
      return jsonResponse({ error: error.message, code: error.code }, 422);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<Params> }) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const deleted = await deleteTemplate(session.user.id, await resolveIdParam(request, params));
  if (!deleted) return jsonResponse({ error: "Not found" }, 404);
  return new Response(null, { status: 204 });
}
