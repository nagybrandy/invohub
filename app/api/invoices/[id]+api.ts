// app/api/invoices/[id]+api.ts
// Single invoice CRUD.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { normalizeFulfillmentDateInput } from "@/lib/invoices/fulfillment-date";
import {
  deleteInvoiceById,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";
import { autoSubmitToNavOnFinalize } from "@/lib/nav/auto-submit";

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

    const body = (await request.json()) as Partial<Invoice>;
    // A non-YYYY-MM-DD value (or one that can't be parsed at all) is
    // normalised away rather than persisted raw — same rule as POST
    // /api/invoices and createInvoiceFromPayload (AC10). Omitting the
    // field entirely keeps the existing value.
    const fulfillmentDate =
      body.fulfillmentDate !== undefined
        ? (normalizeFulfillmentDateInput(body.fulfillmentDate) ?? undefined)
        : existing.fulfillmentDate;
    const updated: Invoice = {
      ...existing,
      ...body,
      id,
      lineItems: body.lineItems ?? existing.lineItems,
      fulfillmentDate,
      updatedAt: new Date().toISOString(),
    };

    const saved = await upsertInvoice(session.user.id, updated);
    // Draft -> final ("Véglegesítés" of a saved draft, incl. a helyesbítő
    // draft -> MODIFY): report to NAV when configured. Never throws.
    const nav = await autoSubmitToNavOnFinalize(session.user.id, existing, saved);
    return jsonResponse({ invoice: saved, nav });
  } catch (error) {
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
    const deleted = await deleteInvoiceById(session.user.id, id);
    if (!deleted) {
      return jsonResponse({ error: "Not found" }, 404);
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
