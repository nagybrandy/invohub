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
import { serializeNavSubmission } from "@/lib/nav/serialize-submission";
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
    // Guarded + idempotent — same rules as POST /api/nav/submit.
    const outcome = await submitOutgoingInvoiceToNav(auth.userId, invoice);
    switch (outcome.kind) {
      case "rejected":
        return jsonApiResponse({ error: "Invoice cannot be submitted to NAV.", code: outcome.code }, outcome.httpStatus);
      case "failed":
        return jsonApiResponse(
          { error: outcome.error, code: "navSubmitFailed", navSubmission: serializeNavSubmission(outcome.submission) },
          502
        );
      case "existing":
        return jsonApiResponse({
          invoice,
          navSubmission: serializeNavSubmission(outcome.submission),
          alreadySubmitted: true,
        });
      default:
        return jsonApiResponse({ invoice, navSubmission: serializeNavSubmission(outcome.submission) });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "NAV submission failed.";
    return jsonApiResponse({ error: message }, 500);
  }
}
