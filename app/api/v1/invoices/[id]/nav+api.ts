// app/api/v1/invoices/[id]/nav+api.ts
// External API: forward an existing invoice to NAV using API key auth.
import {
  jsonApiResponse,
  requireApiKey,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getInvoiceById } from "@/lib/invoices/service";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";

type Params = { id: string };

export async function POST(
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

  try {
    const submission = await submitOutgoingInvoiceToNav(auth.userId, invoice);
    return jsonApiResponse({
      invoice,
      navSubmission: {
        submissionId: submission.submissionId,
        status: submission.status,
        transactionId: submission.transactionId,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NAV submission failed.";
    return jsonApiResponse({ error: message }, 500);
  }
}
