// app/api/v1/invoices/[id]+api.ts
// External API: read/update/delete a single invoice with API key auth,
// scoped to the key's userId — another user's invoice id is always a 404,
// never a 403 (no existence leak). PATCH/DELETE are draft-only (409
// otherwise): a finalized document keeps its continuous number forever.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import {
  updateDraftInvoiceFromPayload,
  type ExternalInvoiceInput,
} from "@/lib/invoices/create-from-payload";
import { deleteDraftInvoiceById, getInvoiceById } from "@/lib/invoices/service";

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

  return jsonApiResponse({ invoice });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  let body: Partial<ExternalInvoiceInput>;
  try {
    body = (await request.json()) as Partial<ExternalInvoiceInput>;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  const result = await updateDraftInvoiceFromPayload(auth.userId, id, body);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return jsonApiResponse({ error: "Invoice not found." }, 404);
    }
    if (result.reason === "not_draft") {
      return jsonApiResponse(
        { error: "Only a draft invoice can be updated.", code: "notDraft" },
        409
      );
    }
    if (result.reason === "company_profile_incomplete") {
      return jsonApiResponse(
        {
          error: "Company profile is incomplete.",
          code: "companyProfileIncomplete",
          missingFields: result.missingFields,
        },
        422
      );
    }
    return jsonApiResponse({ error: result.message, code: "validationError" }, 400);
  }

  return jsonApiResponse({ invoice: result.invoice });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const result = await deleteDraftInvoiceById(auth.userId, id);

  if (result === "not_found") {
    return jsonApiResponse({ error: "Invoice not found." }, 404);
  }
  if (result === "not_draft") {
    return jsonApiResponse(
      { error: "Only a draft invoice can be deleted.", code: "notDraft" },
      409
    );
  }

  return new Response(null, { status: 204 });
}
