// app/api/v1/invoices/[id]/nav+api.ts
// External API: NAV submission status (GET) and forwarding (POST) for an
// existing invoice, using API key auth.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { getInvoiceById } from "@/lib/invoices/service";
import { listNavSubmissionsForInvoice } from "@/lib/nav/list-submissions";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const invoice = await getInvoiceById(auth.userId, id);
  if (!invoice) {
    return jsonApiResponse({ error: "Invoice not found." }, 404);
  }

  const submissions = await listNavSubmissionsForInvoice(invoice.id);
  return jsonApiResponse({ submissions });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
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
