// app/api/invoices/[id]/modify+api.ts
// Starts a helyesbítő (correction) draft prefilled with the original's lines.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { createModificationDraft, getInvoiceById } from "@/lib/invoices/service";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const existing = await getInvoiceById(session.user.id, id);
  if (!existing) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const draft = await createModificationDraft(session.user.id, existing);
  return jsonResponse({ invoice: draft }, 201);
}
