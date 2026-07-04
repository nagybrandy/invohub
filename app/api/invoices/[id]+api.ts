// app/api/invoices/[id]+api.ts
// Single invoice CRUD.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  deleteInvoiceById,
  getInvoiceById,
  upsertInvoice,
} from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

type Params = { id: string };

async function resolveParams(
  params: Promise<Params> | Params | undefined
): Promise<Params> {
  if (params == null) return { id: "" };
  return params instanceof Promise ? params : Promise.resolve(params);
}

export async function GET(
  request: Request,
  { params }: { params?: Promise<Params> | Params }
) {
  try {
    const session = await requireSession(request);
    if (!session) return unauthorizedResponse();

    const { id } = await resolveParams(params);
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

    const { id } = await resolveParams(params);
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

    const { id } = await resolveParams(params);
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
