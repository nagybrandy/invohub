// app/api/invoices/[id]+api.ts
// Single invoice CRUD. A finalized (non-draft) invoice is a legal document
// under Áfa tv. 169. § once it has a real number — it can never be deleted
// or content-edited here; only sztornó/helyesbítő (storno+api.ts,
// modify+api.ts) may touch it after that point. Both violations come back
// as 409 with a stable `code: "invoiceFinalized"` so the UI can show a
// translated explanation instead of a generic error.
import {
  CompanyProfileIncompleteError,
  deleteDraftInvoiceById,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import type { Invoice } from "@/lib/invoices/types";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  try {
    const session = await requireSession(request);
    if (!session) return unauthorizedResponse();

    const id = await resolveIdParam(request, params);
    if (!id?.trim()) {
      return jsonResponse({ error: "Invoice id is required." }, 400);
    }

    const invoice = await getInvoiceById(session.user.id, id);
    if (!invoice) {
      return jsonResponse({ error: "Not found" }, 404);
    }
    return jsonResponse({ invoice });
  } catch (error) {
    console.error("[GET /api/invoices/:id]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      500
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  try {
    const session = await requireSession(request);
    if (!session) return unauthorizedResponse();

    const id = await resolveIdParam(request, params);
    const existing = await getInvoiceById(session.user.id, id);
    if (!existing) {
      return jsonResponse({ error: "Not found" }, 404);
    }

    // A finalized invoice keeps its continuous number and its issued
    // content forever — only the storno/helyesbítő flows (their own
    // routes) may act on it from here. This PATCH route has no other
    // legitimate caller for a non-draft invoice: "mark paid" and the
    // storno status flip each go through their own dedicated endpoints
    // (mark-paid+api.ts, storno+api.ts), never this one.
    if (existing.status !== "draft") {
      return jsonResponse(
        {
          error: "This invoice is already finalized and can no longer be edited.",
          code: "invoiceFinalized",
        },
        409
      );
    }

    const body = (await request.json()) as Partial<Invoice>;
    const updated: Invoice = {
      ...existing,
      ...body,
      id,
      lineItems: body.lineItems ?? existing.lineItems,
      updatedAt: new Date().toISOString(),
    };

    const saved = await upsertInvoice(session.user.id, updated);
    return jsonResponse({ invoice: saved });
  } catch (error) {
    if (error instanceof CompanyProfileIncompleteError) {
      return jsonResponse(
        {
          error: "Company profile is incomplete.",
          code: "companyProfileIncomplete",
          missingFields: error.missingFields,
        },
        422
      );
    }
    console.error("[PATCH /api/invoices/:id]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      500
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  try {
    const session = await requireSession(request);
    if (!session) return unauthorizedResponse();

    const id = await resolveIdParam(request, params);
    const result = await deleteDraftInvoiceById(session.user.id, id);
    if (result === "not_found") {
      return jsonResponse({ error: "Not found" }, 404);
    }
    if (result === "not_draft") {
      return jsonResponse(
        {
          error: "This invoice is already finalized and can no longer be deleted.",
          code: "invoiceFinalized",
        },
        409
      );
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[DELETE /api/invoices/:id]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      500
    );
  }
}
