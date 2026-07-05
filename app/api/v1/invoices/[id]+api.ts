// app/api/v1/invoices/[id]+api.ts
// External API: get invoice by id with API key auth.
import {
  jsonApiResponse,
  requireApiKey,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getInvoiceById } from "@/lib/invoices/service";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const invoice = await getInvoiceById(auth.userId, id);
  if (!invoice) {
    return jsonApiResponse({ error: "Invoice not found." }, 404);
  }

  return jsonApiResponse({ invoice });
}
