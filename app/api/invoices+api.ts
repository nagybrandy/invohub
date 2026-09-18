// app/api/invoices+api.ts
// Invoice list and create API.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { requiresExchangeRate } from "@/lib/invoices/exchange-rate";
import { createId } from "@/lib/id";
import { INVOICE_LIST_LIMIT, INVOICE_LIST_MAX_LIMIT } from "@/lib/invoices/constants";
import { normalizeInvoiceListFilters } from "@/lib/invoices/list-query";
import {
  findLiveConversionsForProformas,
  getInvoiceStats,
  listInvoices,
  upsertInvoice,
} from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

/** Only a positive, finite rate on a non-HUF invoice is ever persisted. */
function normalizeExchangeRate(
  currency: Invoice["currency"],
  raw: unknown
): number | undefined {
  if (!requiresExchangeRate(currency)) return undefined;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  if (!raw) return INVOICE_LIST_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return INVOICE_LIST_LIMIT;
  return Math.min(Math.max(1, parsed), INVOICE_LIST_MAX_LIMIT);
}

function parseOffset(url: URL): number {
  const raw = url.searchParams.get("offset");
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = parseLimit(url);
  const offset = parseOffset(url);
  const filters = normalizeInvoiceListFilters({
    status: url.searchParams.get("status"),
    search: url.searchParams.get("search"),
  });

  const [listResult, stats] = await Promise.all([
    listInvoices(session.user.id, { limit, offset, ...filters }),
    getInvoiceStats(session.user.id),
  ]);

  // Only the current page's díjbekérő rows — never a full-table scan — so
  // the list can show "Számlázva" / "Számla megnyitása" instead of the
  // convert action for one that already has a live invoice (AC12-17).
  const proformaIds = listResult.invoices
    .filter((inv) => inv.documentType === "proforma")
    .map((inv) => inv.id);
  const convertedProformaIds = await findLiveConversionsForProformas(
    session.user.id,
    proformaIds
  );

  return jsonResponse({
    invoices: listResult.invoices,
    total: listResult.total,
    limit: listResult.limit,
    offset: listResult.offset,
    stats,
    convertedProformaIds,
  });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as Partial<Invoice>;
  const now = new Date().toISOString();
  const currency = body.currency ?? "HUF";
  const invoice: Invoice = {
    id: body.id ?? createId(),
    // Left blank when not explicit — assigned atomically at finalize (see lib/invoices/service.ts).
    invoiceNumber: body.invoiceNumber ?? "",
    documentType: body.documentType ?? "invoice",
    clientName: body.clientName ?? "",
    clientTaxNumber: body.clientTaxNumber,
    issueDate: body.issueDate ?? now.slice(0, 10),
    dueDate: body.dueDate ?? now.slice(0, 10),
    status: body.status ?? "draft",
    currency,
    exchangeRate: normalizeExchangeRate(currency, body.exchangeRate),
    lineItems: body.lineItems ?? [],
    notes: body.notes,
    paymentMethod: body.paymentMethod,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
  };

  const saved = await upsertInvoice(session.user.id, invoice);
  return jsonResponse({ invoice: saved }, 201);
}
