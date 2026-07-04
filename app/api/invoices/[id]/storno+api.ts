// app/api/invoices/[id]/storno+api.ts
// Create a storno (cancellation) invoice from an existing one.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  getInvoiceById,
  stornoInvoice,
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

  const storno = stornoInvoice(existing);
  const saved = await upsertInvoice(session.user.id, storno);
  return jsonResponse({ invoice: saved }, 201);
}
