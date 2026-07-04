// app/api/invoices/[id]/duplicate+api.ts
// Duplicate an invoice as a new draft.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  duplicateInvoice,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const existing = await getInvoiceById(session.user.id, id);
  if (!existing) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const copy = duplicateInvoice(existing);
  const saved = await upsertInvoice(session.user.id, copy);
  return jsonResponse({ invoice: saved }, 201);
}
