// app/api/invoices/[id]+api.ts
// Single invoice CRUD.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { autofillMissingExchangeRate } from "@/lib/invoices/exchange-rate-autofill";
import { requiresExchangeRate } from "@/lib/invoices/exchange-rate";
import {
  deleteInvoiceById,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

/** True when the stored value isn't a usable positive, finite rate. */
function needsExchangeRate(currency: Invoice["currency"], rate: number | undefined): boolean {
  return (
    requiresExchangeRate(currency) &&
    !(typeof rate === "number" && Number.isFinite(rate) && rate > 0)
  );
}

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
    const updated: Invoice = {
      ...existing,
      ...body,
      id,
      lineItems: body.lineItems ?? existing.lineItems,
      updatedAt: new Date().toISOString(),
    };

    // Server safety net (item 6): covers both an edit that switches
    // currency away from HUF and the composer's "Véglegesítés" (finalize)
    // action, which is just a status-changing PATCH here — never overrides
    // a rate the request itself already carried.
    if (needsExchangeRate(updated.currency, updated.exchangeRate)) {
      updated.exchangeRate = await autofillMissingExchangeRate({
        currency: updated.currency,
        exchangeRate: updated.exchangeRate,
        issueDate: updated.issueDate,
      });
    }

    const saved = await upsertInvoice(session.user.id, updated);
    return jsonResponse({ invoice: saved });
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
